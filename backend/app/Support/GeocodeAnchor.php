<?php

namespace App\Support;

use App\Models\JobOrder;

final class GeocodeAnchor
{
    public function __construct(
        public readonly ?string $city = null,
        public readonly ?string $province = null,
        public readonly ?string $region = null,
        public readonly ?string $barangay = null,
    ) {
    }

    public static function fromJobOrder(JobOrder $jobOrder, string $prefix): self
    {
        return new self(
            city: self::nonEmpty($jobOrder->{"{$prefix}_city"} ?? null),
            province: self::nonEmpty($jobOrder->{"{$prefix}_province"} ?? null),
            region: self::nonEmpty($jobOrder->{"{$prefix}_region"} ?? null),
            barangay: self::nonEmpty($jobOrder->{"{$prefix}_barangay"} ?? null),
        );
    }

    /** @param array{city?: string|null, province?: string|null, region?: string|null, barangay?: string|null} $anchor */
    public static function fromArray(array $anchor): self
    {
        return new self(
            city: self::nonEmpty($anchor['city'] ?? null),
            province: self::nonEmpty($anchor['province'] ?? null),
            region: self::nonEmpty($anchor['region'] ?? null),
            barangay: self::nonEmpty($anchor['barangay'] ?? null),
        );
    }

    public function hasLocality(): bool
    {
        return ($this->city ?? '') !== '';
    }

    public function isNcr(): bool
    {
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
        ])));
    }

    public function centroidCacheKey(): string
    {
        return 'deliverex.geocode.centroid.v2.'.$this->cacheKeySuffix();
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

        $parts = array_values(array_filter([
            $barangay,
            $this->city,
            $province,
            $this->isNcr() ? null : $this->region,
            'Philippines',
        ], static fn (?string $value): bool => ($value ?? '') !== ''));

        return implode(', ', $parts);
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
