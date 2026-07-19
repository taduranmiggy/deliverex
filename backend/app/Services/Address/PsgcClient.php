<?php

namespace App\Services\Address;

use App\Support\Utf8Text;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class PsgcClient
{
    /** @return list<array<string, mixed>> */
    public function regions(): array
    {
        return $this->get('regions');
    }

    /** @return list<array<string, mixed>> */
    public function provinces(string $regionCode): array
    {
        return $this->get(sprintf('regions/%s/provinces', rawurlencode($regionCode)));
    }

    /** @return list<array<string, mixed>> */
    public function citiesMunicipalities(string $regionCode, ?string $provinceCode = null): array
    {
        $path = $provinceCode
            ? sprintf(
                'regions/%s/provinces/%s/cities-municipalities',
                rawurlencode($regionCode),
                rawurlencode($provinceCode),
            )
            : sprintf('regions/%s/cities-municipalities', rawurlencode($regionCode));

        return $this->filterSelectableCities($this->get($path));
    }

    /** @return list<array<string, mixed>> */
    public function barangays(string $regionCode, ?string $provinceCode, string $cityCode): array
    {
        $barangays = $this->fetchDirectBarangays($regionCode, $provinceCode, $cityCode);

        if ($barangays !== []) {
            return $barangays;
        }

        return $this->aggregateBarangaysFromSubMunicipalities($regionCode, $provinceCode, $cityCode);
    }

    /**
     * @return array{
     *   region:array<string,mixed>,
     *   province:?array<string,mixed>,
     *   city:array<string,mixed>,
     *   barangay:array<string,mixed>
     * }
     */
    public function resolveHierarchy(
        string $regionCode,
        ?string $provinceCode,
        string $cityCode,
        string $barangayCode,
    ): array {
        $region = $this->findByCode($this->regions(), $regionCode);
        if (! $region) {
            throw new RuntimeException('The selected PSGC region is invalid.');
        }

        $province = null;
        $provinces = $this->provinces($regionCode);
        if ($provinceCode !== null && $provinceCode !== '') {
            $province = $this->findByCode($provinces, $provinceCode);
            if (! $province) {
                throw new RuntimeException('The selected province does not belong to the selected region.');
            }
        } elseif ($provinces !== []) {
            throw new RuntimeException('A province is required for the selected region.');
        }

        $cities = $this->citiesMunicipalities($regionCode, $province['code'] ?? null);
        $city = $this->findByCode($cities, $cityCode);
        if (! $city) {
            throw new RuntimeException('The selected city or municipality does not belong to the selected administrative area.');
        }

        $barangay = $this->findByCode(
            $this->barangays($regionCode, $province['code'] ?? null, $cityCode),
            $barangayCode,
        );
        if (! $barangay) {
            throw new RuntimeException('The selected barangay does not belong to the selected city or municipality.');
        }

        return compact('region', 'province', 'city', 'barangay');
    }

    /** @return list<array<string, mixed>> */
    private function get(string $path): array
    {
        $path = ltrim($path, '/');
        $key = 'deliverex.psgc.v4.'.sha1($path);

        return Cache::remember($key, (int) config('psgc.cache_ttl', 604800), function () use ($path): array {
            $response = Http::acceptJson()
                ->timeout((int) config('psgc.timeout', 12))
                ->retry(2, 250, throw: false)
                ->get(rtrim((string) config('psgc.base_url'), '/').'/'.$path);

            return $this->decode($response, $path);
        });
    }

    /** @return list<array<string, mixed>> */
    private function decode(Response $response, string $path): array
    {
        if (! $response->successful()) {
            throw new RuntimeException(sprintf(
                'PSGC API request failed for %s (HTTP %d).',
                $path,
                $response->status(),
            ));
        }

        $payload = $response->json();
        if (is_array($payload) && isset($payload['data']) && is_array($payload['data'])) {
            $payload = $payload['data'];
        }

        if (! is_array($payload)) {
            throw new RuntimeException('PSGC API returned an invalid response.');
        }

        $rows = array_is_list($payload) ? $payload : [$payload];

        return array_values(array_filter(array_map(function ($row): ?array {
            if (! is_array($row) || ! isset($row['code'], $row['name'])) {
                return null;
            }

            $row['name'] = Utf8Text::displayUpper((string) $row['name']);

            return $row;
        }, $rows)));
    }

    /** @param list<array<string,mixed>> $rows */
    private function findByCode(array $rows, string $code): ?array
    {
        foreach ($rows as $row) {
            if ((string) ($row['code'] ?? '') === $code) {
                return $row;
            }
        }

        return null;
    }

    /**
     * Composite cities such as City of Manila expose districts as SubMun rows
     * instead of direct barangays. Hide the parent when districts are present.
     *
     * @param list<array<string,mixed>> $cities
     * @return list<array<string,mixed>>
     */
    private function filterSelectableCities(array $cities): array
    {
        return array_values(array_filter(
            $cities,
            fn (array $city): bool => ! $this->isCompositeParentCity($city, $cities),
        ));
    }

    /** @param list<array<string,mixed>> $cities */
    private function isCompositeParentCity(array $city, array $cities): bool
    {
        $code = (string) ($city['code'] ?? '');
        if (($city['type'] ?? '') !== 'City' || ! str_ends_with($code, '0000')) {
            return false;
        }

        foreach ($cities as $candidate) {
            if (($candidate['type'] ?? '') !== 'SubMun') {
                continue;
            }

            $candidateCode = (string) ($candidate['code'] ?? '');
            if ($candidateCode !== $code && $this->isSubMunicipalityOf($candidateCode, $code)) {
                return true;
            }
        }

        return false;
    }

    /** @return list<array<string,mixed>> */
    private function aggregateBarangaysFromSubMunicipalities(
        string $regionCode,
        ?string $provinceCode,
        string $cityCode,
    ): array {
        $path = $provinceCode
            ? sprintf(
                'regions/%s/provinces/%s/cities-municipalities',
                rawurlencode($regionCode),
                rawurlencode($provinceCode),
            )
            : sprintf('regions/%s/cities-municipalities', rawurlencode($regionCode));

        $cities = $this->get($path);
        $subMunicipalities = array_values(array_filter(
            $cities,
            fn (array $city): bool => ($city['type'] ?? '') === 'SubMun'
                && $this->isSubMunicipalityOf((string) ($city['code'] ?? ''), $cityCode),
        ));

        if ($subMunicipalities === []) {
            return [];
        }

        $barangays = [];
        foreach ($subMunicipalities as $subMunicipality) {
            $subCode = (string) $subMunicipality['code'];
            $district = (string) $subMunicipality['name'];

            foreach ($this->fetchDirectBarangays($regionCode, $provinceCode, $subCode) as $barangay) {
                $barangays[] = [
                    ...$barangay,
                    'name' => $district.' — '.($barangay['name'] ?? ''),
                    'district_code' => $subCode,
                    'district' => $district,
                ];
            }
        }

        return $barangays;
    }

    /** @return list<array<string,mixed>> */
    private function fetchDirectBarangays(string $regionCode, ?string $provinceCode, string $cityCode): array
    {
        $path = $provinceCode
            ? sprintf(
                'regions/%s/provinces/%s/cities-municipalities/%s/barangays',
                rawurlencode($regionCode),
                rawurlencode($provinceCode),
                rawurlencode($cityCode),
            )
            : sprintf(
                'regions/%s/cities-municipalities/%s/barangays',
                rawurlencode($regionCode),
                rawurlencode($cityCode),
            );

        try {
            return $this->get($path);
        } catch (RuntimeException $exception) {
            if ($provinceCode !== null) {
                throw $exception;
            }

            return $this->get(sprintf(
                'cities-municipalities/%s/barangays',
                rawurlencode($cityCode),
            ));
        }
    }

    private function isSubMunicipalityOf(string $subCode, string $parentCityCode): bool
    {
        if (strlen($subCode) !== 10 || strlen($parentCityCode) !== 10) {
            return false;
        }

        if ($subCode === $parentCityCode || ! str_ends_with($parentCityCode, '0000')) {
            return false;
        }

        return str_starts_with($subCode, substr($parentCityCode, 0, 5));
    }
}
