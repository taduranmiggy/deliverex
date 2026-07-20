<?php

namespace App\Support;

use App\Models\JobOrder;

final class GeocodeAnchor
{
    public function __construct(
        public readonly ?string $city = null,
        public readonly ?string $province = null,
        public readonly ?string $region = null,
    ) {
    }

    public static function fromJobOrder(JobOrder $jobOrder, string $prefix): self
    {
        return new self(
            city: self::nonEmpty($jobOrder->{"{$prefix}_city"} ?? null),
            province: self::nonEmpty($jobOrder->{"{$prefix}_province"} ?? null),
            region: self::nonEmpty($jobOrder->{"{$prefix}_region"} ?? null),
        );
    }

    /** @param array{city?: string|null, province?: string|null, region?: string|null} $anchor */
    public static function fromArray(array $anchor): self
    {
        return new self(
            city: self::nonEmpty($anchor['city'] ?? null),
            province: self::nonEmpty($anchor['province'] ?? null),
            region: self::nonEmpty($anchor['region'] ?? null),
        );
    }

    public function hasLocality(): bool
    {
        return ($this->city ?? '') !== '';
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
        ])));
    }

    public function centroidCacheKey(): string
    {
        return 'deliverex.geocode.centroid.v1.'.$this->cacheKeySuffix();
    }

    public function localityQuery(): ?string
    {
        if (! $this->hasLocality()) {
            return null;
        }

        $parts = array_values(array_filter([
            $this->city,
            $this->province,
            $this->region,
            'Philippines',
        ], static fn (?string $value): bool => ($value ?? '') !== ''));

        return implode(', ', $parts);
    }

    /** @return list<string> */
    public function localityTokens(): array
    {
        $tokens = [];

        foreach ([$this->city, $this->province, $this->region] as $label) {
            $normalized = self::normalizePlaceName($label);
            if ($normalized !== '') {
                $tokens[] = $normalized;
            }
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
        $value = preg_replace('/[^a-z0-9\s]/', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/', ' ', $value) ?? $value;

        return trim($value);
    }

    private static function nonEmpty(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text !== '' ? $text : null;
    }
}
