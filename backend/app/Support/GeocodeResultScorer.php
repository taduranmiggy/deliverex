<?php

namespace App\Support;

final class GeocodeResultScorer
{
    private const DEFAULT_MAX_DISTANCE_KM = 35.0;

    private const NCR_MAX_DISTANCE_KM = 12.0;

    /** @var array{min_lat: float, max_lat: float, min_lng: float, max_lng: float} */
    private const NCR_BOUNDS = [
        'min_lat' => 14.42,
        'max_lat' => 14.78,
        'min_lng' => 120.90,
        'max_lng' => 121.10,
    ];

    /** @var list<string> */
    private const NCR_CONFLICT_PROVINCES = [
        'rizal',
        'bulacan',
        'cavite',
        'laguna',
        'batangas',
        'pampanga',
        'zambales',
    ];

    /**
     * @param  array{lat: float, lng: float}  $coords
     * @param  list<string>  $labels
     */
    public function accepts(GeocodeAnchor $anchor, array $coords, array $labels, ?array $centroid): bool
    {
        if (! $anchor->hasLocality()) {
            return true;
        }

        if (! $this->coordsWithinExpectedArea($anchor, $coords)) {
            return false;
        }

        if ($this->conflictsWithAnchor($anchor, $labels)) {
            return false;
        }

        if (! $centroid) {
            return $this->labelsMatchAnchor($anchor, $labels);
        }

        $distanceKm = $this->distanceKm($coords, $centroid);
        if ($distanceKm > $this->maxAllowedDistanceKm($anchor)) {
            return false;
        }

        if ($distanceKm <= 5.0) {
            return true;
        }

        return $this->labelsMatchAnchor($anchor, $labels);
    }

    /**
     * @param  array{lat: float, lng: float}  $coords
     */
    public function storedCoordinatesMatch(GeocodeAnchor $anchor, array $coords, ?array $centroid): bool
    {
        if (! $anchor->hasLocality()) {
            return true;
        }

        if (! $this->coordsWithinExpectedArea($anchor, $coords)) {
            return false;
        }

        if (! $centroid) {
            return false;
        }

        return $this->distanceKm($coords, $centroid) <= $this->maxAllowedDistanceKm($anchor);
    }

    /**
     * @param  array{lat: float, lng: float}  $coords
     */
    public function coordsWithinExpectedArea(GeocodeAnchor $anchor, array $coords): bool
    {
        if ($anchor->isNcr()) {
            return $this->isWithinNcrBounds($coords);
        }

        return true;
    }

    public function maxAllowedDistanceKm(GeocodeAnchor $anchor): float
    {
        if ($anchor->isNcr()) {
            return self::NCR_MAX_DISTANCE_KM;
        }

        if (($anchor->barangay ?? '') !== '') {
            return 25.0;
        }

        return self::DEFAULT_MAX_DISTANCE_KM;
    }

    /**
     * @param  array{lat: float, lng: float}  $a
     * @param  array{lat: float, lng: float}  $b
     */
    public function distanceKm(array $a, array $b): float
    {
        return GpsCoordinateValidator::distanceMeters($a['lat'], $a['lng'], $b['lat'], $b['lng']) / 1000;
    }

    /**
     * @param  array{lat: float, lng: float}  $coords
     * @param  list<string>  $labels
     */
    public function score(GeocodeAnchor $anchor, array $coords, array $labels, ?array $centroid): float
    {
        if (! $this->accepts($anchor, $coords, $labels, $centroid)) {
            return -1.0;
        }

        $score = 100.0;

        if ($centroid) {
            $distanceKm = $this->distanceKm($coords, $centroid);
            $score -= min(80.0, $distanceKm * 1.6);
        }

        $haystack = $this->normalizedLabelHaystack($labels);

        foreach ($anchor->localityTokens() as $token) {
            if ($token !== '' && str_contains($haystack, $token)) {
                $score += 12.0;
            }
        }

        return $score;
    }

    /** @param  list<string>  $labels */
    public function conflictsWithAnchor(GeocodeAnchor $anchor, array $labels): bool
    {
        if (! $anchor->isNcr()) {
            return false;
        }

        $haystack = $this->normalizedLabelHaystack($labels);

        foreach (self::NCR_CONFLICT_PROVINCES as $province) {
            if (preg_match('/\b'.preg_quote($province, '/').'\b/', $haystack) === 1) {
                return true;
            }
        }

        return false;
    }

    /** @param  array{lat: float, lng: float}  $coords */
    private function isWithinNcrBounds(array $coords): bool
    {
        return $coords['lat'] >= self::NCR_BOUNDS['min_lat']
            && $coords['lat'] <= self::NCR_BOUNDS['max_lat']
            && $coords['lng'] >= self::NCR_BOUNDS['min_lng']
            && $coords['lng'] <= self::NCR_BOUNDS['max_lng'];
    }

    /** @param  list<string>  $labels */
    private function labelsMatchAnchor(GeocodeAnchor $anchor, array $labels): bool
    {
        $haystack = $this->normalizedLabelHaystack($labels);
        if ($haystack === '') {
            return false;
        }

        foreach ($anchor->localityTokens() as $token) {
            if (mb_strlen($token) >= 4 && str_contains($haystack, $token)) {
                return true;
            }
        }

        return false;
    }

    /** @param  list<string>  $labels */
    private function normalizedLabelHaystack(array $labels): string
    {
        return implode(' ', array_map(
            static fn (string $label): string => GeocodeAnchor::normalizePlaceName($label),
            $labels,
        ));
    }
}
