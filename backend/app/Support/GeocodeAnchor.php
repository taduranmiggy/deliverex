<?php

namespace App\Support;

use App\Models\JobOrder;

final class GeocodeAnchor
{
    private const NCR_REGION_CODE = '1300000000';

    /** @var array<string, array{lat: float, lng: float}> */
    private const FALLBACK_CENTROIDS = [
        'sampaloc' => ['lat' => 14.6042, 'lng' => 120.9892],
        'manila' => ['lat' => 14.5995, 'lng' => 120.9842],
        'city of manila' => ['lat' => 14.5995, 'lng' => 120.9842],
        'quezon city' => ['lat' => 14.6760, 'lng' => 121.0437],
        'makati' => ['lat' => 14.5547, 'lng' => 121.0244],
        'pasig' => ['lat' => 14.5764, 'lng' => 121.0851],
        'taguig' => ['lat' => 14.5176, 'lng' => 121.0509],
        'marikina' => ['lat' => 14.6507, 'lng' => 121.1029],
        'pasay' => ['lat' => 14.5378, 'lng' => 121.0014],
        'caloocan' => ['lat' => 14.6488, 'lng' => 120.9830],
        'malabon' => ['lat' => 14.6626, 'lng' => 120.9568],
        'navotas' => ['lat' => 14.6667, 'lng' => 120.9417],
        'valenzuela' => ['lat' => 14.7000, 'lng' => 120.9830],
        'san juan' => ['lat' => 14.6019, 'lng' => 121.0355],
        'mandaluyong' => ['lat' => 14.5794, 'lng' => 121.0359],
        'las pinas' => ['lat' => 14.4493, 'lng' => 120.9930],
        'muntinlupa' => ['lat' => 14.4081, 'lng' => 121.0415],
        'paranaque' => ['lat' => 14.4793, 'lng' => 121.0198],
        'ermita' => ['lat' => 14.5833, 'lng' => 120.9833],
        'tondo' => ['lat' => 14.6167, 'lng' => 120.9667],
        'quiapo' => ['lat' => 14.5989, 'lng' => 120.9847],
        'malate' => ['lat' => 14.5625, 'lng' => 120.9944],
        'paco' => ['lat' => 14.5808, 'lng' => 121.0131],
        'santa mesa' => ['lat' => 14.6011, 'lng' => 121.0147],
        'san miguel' => ['lat' => 14.5936, 'lng' => 121.0036],
        'santa ana' => ['lat' => 14.5833, 'lng' => 121.0125],
        'santa cruz' => ['lat' => 14.6167, 'lng' => 120.9833],
        'binondo' => ['lat' => 14.6000, 'lng' => 120.9750],
        'intramuros' => ['lat' => 14.5906, 'lng' => 120.9750],
        'rodriguez' => ['lat' => 14.7600, 'lng' => 121.2000],
        'antipolo' => ['lat' => 14.6255, 'lng' => 121.1245],
    ];

    /** @var list<string> */
    private const NCR_LOCALITIES = [
        'sampaloc', 'ermita', 'tondo', 'quiapo', 'malate', 'paco', 'pandacan', 'port area',
        'san andres', 'san miguel', 'san nicolas', 'santa ana', 'santa cruz', 'santa mesa',
        'binondo', 'intramuros', 'manila', 'city of manila',
        'quezon city', 'makati', 'pasig', 'taguig', 'marikina', 'pasay', 'caloocan',
        'malabon', 'navotas', 'valenzuela', 'san juan', 'mandaluyong', 'las pinas',
        'muntinlupa', 'paranaque',
    ];

    public function __construct(
        public readonly ?string $city = null,
        public readonly ?string $province = null,
        public readonly ?string $region = null,
        public readonly ?string $barangay = null,
        public readonly ?string $regionCode = null,
    ) {
    }

    public static function fromJobOrder(JobOrder $jobOrder, string $prefix): self
    {
        return new self(
            city: self::nonEmpty($jobOrder->{"{$prefix}_city"} ?? null),
            province: self::nonEmpty($jobOrder->{"{$prefix}_province"} ?? null),
            region: self::nonEmpty($jobOrder->{"{$prefix}_region"} ?? null),
            barangay: self::nonEmpty($jobOrder->{"{$prefix}_barangay"} ?? null),
            regionCode: self::nonEmpty($jobOrder->{"{$prefix}_region_code"} ?? null),
        );
    }

    /** @param array{city?: string|null, province?: string|null, region?: string|null, barangay?: string|null, region_code?: string|null} $anchor */
    public static function fromArray(array $anchor): self
    {
        return new self(
            city: self::nonEmpty($anchor['city'] ?? null),
            province: self::nonEmpty($anchor['province'] ?? null),
            region: self::nonEmpty($anchor['region'] ?? null),
            barangay: self::nonEmpty($anchor['barangay'] ?? null),
            regionCode: self::nonEmpty($anchor['region_code'] ?? null),
        );
    }

    public function hasLocality(): bool
    {
        return ($this->city ?? '') !== '';
    }

    public function isNcr(): bool
    {
        if ($this->regionCode === self::NCR_REGION_CODE) {
            return true;
        }

        if (self::isKnownNcrLocality($this->city)) {
            return true;
        }

        foreach ([$this->region, $this->province] as $label) {
            $normalized = self::normalizePlaceName($label);
            if ($normalized === '') {
                continue;
            }

            if (str_contains($normalized, 'ncr')
                || str_contains($normalized, 'national capital')
                || str_contains($normalized, 'metro manila')) {
                return true;
            }
        }

        return false;
    }

    /** @return array{lat: float, lng: float}|null */
    public function fallbackCentroid(): ?array
    {
        foreach ($this->centroidLookupKeys() as $key) {
            if (isset(self::FALLBACK_CENTROIDS[$key])) {
                return self::FALLBACK_CENTROIDS[$key];
            }
        }

        return null;
    }

    /** @return list<string> */
    public function geocodeFallbackQueries(): array
    {
        $queries = [];
        $barangay = self::formatBarangayLabel($this->barangay);
        $province = ($this->province !== null && $this->province !== '')
            ? $this->province
            : ($this->isNcr() ? 'Metro Manila' : null);

        if ($this->isNcr()) {
            if ($barangay && $this->city) {
                $queries[] = implode(', ', array_filter([$barangay, $this->city, 'Manila', 'Metro Manila', 'Philippines']));
            }

            if ($this->city) {
                $queries[] = implode(', ', array_filter([$this->city, 'Manila', 'Metro Manila', 'Philippines']));
                $queries[] = implode(', ', array_filter([$this->city, 'Metro Manila', 'Philippines']));
            }
        }

        if ($this->city) {
            $queries[] = implode(', ', array_filter([$this->city, $province, $this->region, 'Philippines']));
        }

        return array_values(array_unique(array_filter($queries)));
    }

    public function cacheKeySuffix(): string
    {
        if (! $this->hasLocality()) {
            return '';
        }

        return '|'.md5(mb_strtolower(implode('|', [
            $this->city ?? '',
            $this->province ?? '',
            $this->region ?? '',
            $this->barangay ?? '',
            $this->regionCode ?? '',
        ])));
    }

    public function centroidCacheKey(): string
    {
        return 'deliverex.geocode.centroid.v3.'.$this->cacheKeySuffix();
    }

    public function localityQuery(): ?string
    {
        if (! $this->hasLocality()) {
            return null;
        }

        $barangay = self::formatBarangayLabel($this->barangay);
        $province = $this->province;

        if ($this->isNcr() && ($province === null || $province === '')) {
            $province = 'Metro Manila';
        }

        if ($this->isNcr() && self::isKnownManilaDistrict($this->city)) {
            $parts = array_values(array_filter([
                $barangay,
                $this->city,
                'Manila',
                $province,
                'Philippines',
            ], static fn (?string $value): bool => ($value ?? '') !== ''));

            return implode(', ', $parts);
        }

        $parts = array_values(array_filter([
            $barangay,
            $this->city,
            $province,
            $this->isNcr() ? null : $this->region,
            'Philippines',
        ], static fn (?string $value): bool => ($value ?? '') !== ''));

        return implode(', ', $parts);
    }

    /** @return array{lat: float, lng: float} */
    public function focusPoint(): array
    {
        return $this->fallbackCentroid() ?? ['lat' => 14.5995, 'lng' => 120.9842];
    }

    /** @return list<string> */
    public function localityTokens(): array
    {
        $tokens = [];

        foreach ([$this->barangay, $this->city, $this->province, $this->region] as $label) {
            $normalized = self::normalizePlaceName($label);
            if ($normalized !== '' && ! self::isNumericBarangayToken($normalized)) {
                $tokens[] = $normalized;
            }
        }

        if ($this->isNcr()) {
            $tokens[] = 'metro manila';
            $tokens[] = 'manila';
        }

        return array_values(array_unique($tokens));
    }

    public static function normalizePlaceName(?string $value): string
    {
        $value = mb_strtolower(trim((string) ($value ?? '')));
        if ($value === '') {
            return '';
        }

        $value = preg_replace('/\(([^)]+)\)/', ' $1 ', $value) ?? $value;
        $value = preg_replace('/\b(city of|municipality of|municipalities of)\b/', '', $value) ?? $value;
        $value = preg_replace('/\b(province of|region of)\b/', '', $value) ?? $value;
        $value = preg_replace('/\b(barangay|brgy\.?\s*)/', '', $value) ?? $value;
        $value = preg_replace('/[^a-z0-9\s]/', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/', ' ', $value) ?? $value;

        return trim($value);
    }

    /** @return list<string> */
    private function centroidLookupKeys(): array
    {
        $keys = [];

        foreach ([self::normalizePlaceName($this->city), self::normalizePlaceName($this->province)] as $key) {
            if ($key !== '') {
                $keys[] = $key;
            }
        }

        return array_values(array_unique($keys));
    }

    private static function isKnownNcrLocality(?string $city): bool
    {
        $normalized = self::normalizePlaceName($city);
        if ($normalized === '') {
            return false;
        }

        return in_array($normalized, self::NCR_LOCALITIES, true);
    }

    private static function isKnownManilaDistrict(?string $city): bool
    {
        $normalized = self::normalizePlaceName($city);
        if ($normalized === '') {
            return false;
        }

        if (in_array($normalized, ['manila', 'city of manila'], true)) {
            return false;
        }

        return in_array($normalized, self::NCR_LOCALITIES, true)
            && ! in_array($normalized, ['quezon city', 'makati', 'pasig', 'taguig', 'marikina', 'pasay', 'caloocan', 'malabon', 'navotas', 'valenzuela', 'san juan', 'mandaluyong', 'las pinas', 'muntinlupa', 'paranaque'], true);
    }

    private static function formatBarangayLabel(?string $barangay): ?string
    {
        $barangay = trim((string) ($barangay ?? ''));
        if ($barangay === '') {
            return null;
        }

        if (preg_match('/^(barangay|brgy\.?\s)/i', $barangay)) {
            return $barangay;
        }

        return 'Barangay '.$barangay;
    }

    private static function isNumericBarangayToken(string $token): bool
    {
        return preg_match('/^\d+$/', $token) === 1;
    }

    private static function nonEmpty(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text !== '' ? $text : null;
    }
}
