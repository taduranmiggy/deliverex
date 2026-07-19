<?php

namespace App\Services\Address;

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

        return $this->get($path);
    }

    /** @return list<array<string, mixed>> */
    public function barangays(string $regionCode, ?string $provinceCode, string $cityCode): array
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
            // PSGC cities without a province (notably NCR) remain strictly
            // validated by the region city list, while this canonical endpoint
            // supplies their barangays across API deployments.
            if ($provinceCode !== null) {
                throw $exception;
            }

            return $this->get(sprintf(
                'cities-municipalities/%s/barangays',
                rawurlencode($cityCode),
            ));
        }
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
        $key = 'deliverex.psgc.v2.'.sha1($path);

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

        return array_values(array_filter($rows, static fn ($row): bool =>
            is_array($row) && isset($row['code'], $row['name'])
        ));
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
}
