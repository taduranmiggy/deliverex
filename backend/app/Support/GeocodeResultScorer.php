<?php

namespace App\Support;

final class GeocodeResultScorer
{
    private const MAX_DISTANCE_KM = 45.0;

    /**
     * @param  array{lat: float, lng: float}  $coords
     * @param  list<string>  $labels
     */
    public function accepts(GeocodeAnchor $anchor, array $coords, array $labels, ?array $centroid): bool
    {
        if (! $anchor->hasLocality()) {
            return true;
        }

        if ($centroid && $this->distanceKm($coords, $centroid) > self::MAX_DISTANCE_KM) {
            return false;
        }

        $tokens = $anchor->localityTokens();
        if ($tokens === []) {
            return true;
        }

        $haystack = implode(' ', array_map(
            static fn (string $label): string => GeocodeAnchor::normalizePlaceName($label),
            $labels,
        ));

        if ($haystack === '') {
            return $centroid !== null;
        }

        foreach ($tokens as $token) {
            if (str_contains($haystack, $token)) {
                return true;
            }
        }

        return $centroid !== null && $this->distanceKm($coords, $centroid) <= 25.0;
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

        $haystack = implode(' ', array_map(
            static fn (string $label): string => GeocodeAnchor::normalizePlaceName($label),
            $labels,
        ));

        foreach ($anchor->localityTokens() as $token) {
            if ($token !== '' && str_contains($haystack, $token)) {
                $score += 12.0;
            }
        }

        return $score;
    }
}
