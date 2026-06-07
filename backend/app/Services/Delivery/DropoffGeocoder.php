<?php

namespace App\Services\Delivery;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DropoffGeocoder
{
    /**
     * Resolve latitude/longitude for a drop-off address via OpenStreetMap Nominatim.
     *
     * @return array{lat: float, lng: float}|null
     */
    public function geocode(string $address): ?array
    {
        $query = trim($address);
        if ($query === '') {
            return null;
        }

        if (! str_contains(strtolower($query), 'philippines')) {
            $query .= ', Philippines';
        }

        try {
            $response = Http::withHeaders([
                'User-Agent' => 'Deliverex/1.0 (logistics capstone)',
            ])
                ->timeout(8)
                ->get('https://nominatim.openstreetmap.org/search', [
                    'q'              => $query,
                    'format'         => 'json',
                    'limit'          => 1,
                    'addressdetails' => 0,
                ]);

            if (! $response->successful()) {
                return null;
            }

            $results = $response->json();
            if (! is_array($results) || empty($results[0]['lat']) || empty($results[0]['lon'])) {
                return null;
            }

            return [
                'lat' => (float) $results[0]['lat'],
                'lng' => (float) $results[0]['lon'],
            ];
        } catch (\Throwable $e) {
            Log::warning('Drop-off geocoding failed', [
                'address' => $address,
                'error'   => $e->getMessage(),
            ]);

            return null;
        }
    }
}
