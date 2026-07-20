<?php

namespace App\Services\Delivery;

use App\Models\JobOrder;
use App\Services\Gps\RouteDirectionsService;
use App\Support\GeocodeAnchor;
use App\Support\GpsCoordinateValidator;
use App\Support\JobOrderAddressFormatter;
use App\Support\LocationPipelineLogger;
use App\Support\LocationTraceRecorder;
use App\Support\StreetGeocodeHelper;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class JobOrderLocationService
{
    public function __construct(
        private AddressGeocoder $geocoder,
        private RouteDirectionsService $directions,
    ) {
    }

    public function ensureCoordinates(JobOrder $jobOrder, bool $retryMissing = false): JobOrder
    {
        $jobOrder->loadMissing('quarry');
        $updates = [];
        $geocodedPickup = false;

        $pickupAnchor = GeocodeAnchor::fromJobOrder($jobOrder, 'pickup');
        $validatedPickup = $this->geocoder->validateStoredCoordinates(
            $jobOrder->pickup_latitude,
            $jobOrder->pickup_longitude,
            $pickupAnchor,
        );

        if ($validatedPickup === null
            && GpsCoordinateValidator::isUsable($jobOrder->pickup_latitude, $jobOrder->pickup_longitude)) {
            $updates = array_merge($updates, [
                'pickup_latitude' => null,
                'pickup_longitude' => null,
                'pickup_geocode_attempted_at' => null,
            ]);
            $jobOrder->pickup_latitude = null;
            $jobOrder->pickup_longitude = null;
            $jobOrder->pickup_geocode_attempted_at = null;
        }

        if (! GpsCoordinateValidator::isUsable($jobOrder->pickup_latitude, $jobOrder->pickup_longitude)
            && ($jobOrder->pickup_geocode_attempted_at === null || $retryMissing)) {
            $updates['pickup_geocode_attempted_at'] = now();
            $pickupCoords = $this->resolveSideCoordinates(
                $jobOrder,
                'pickup',
                $pickupAnchor,
                $this->pickupGeocodeCandidates(
                    $jobOrder,
                    trim((string) ($jobOrder->pickup_street ?? '')) !== '',
                ),
            );

            if ($pickupCoords) {
                $updates = array_merge($updates, $this->coordinateUpdates('pickup', $pickupCoords));
                $geocodedPickup = true;
                LocationPipelineLogger::log('geocode_pickup_result', [
                    'job_order_id' => $jobOrder->id,
                    'lat' => $pickupCoords['lat'],
                    'lng' => $pickupCoords['lng'],
                ]);
            } else {
                Log::warning('Pickup geocoding failed', [
                    'job_order_id' => $jobOrder->id,
                ]);
                $updates = array_merge($updates, $this->clearInvalidCoordinateColumns(
                    $jobOrder->pickup_latitude,
                    $jobOrder->pickup_longitude,
                    'pickup',
                ));
            }
        }

        $dropoffAnchor = GeocodeAnchor::fromJobOrder($jobOrder, 'dropoff');
        $validatedDropoff = $this->geocoder->validateStoredCoordinates(
            $jobOrder->dropoff_latitude,
            $jobOrder->dropoff_longitude,
            $dropoffAnchor,
        );

        if ($validatedDropoff === null
            && GpsCoordinateValidator::isUsable($jobOrder->dropoff_latitude, $jobOrder->dropoff_longitude)) {
            $updates = array_merge($updates, [
                'dropoff_latitude' => null,
                'dropoff_longitude' => null,
                'dropoff_geocode_attempted_at' => null,
            ]);
            $jobOrder->dropoff_latitude = null;
            $jobOrder->dropoff_longitude = null;
            $jobOrder->dropoff_geocode_attempted_at = null;
        }

        if (! GpsCoordinateValidator::isUsable($jobOrder->dropoff_latitude, $jobOrder->dropoff_longitude)
            && ($jobOrder->dropoff_geocode_attempted_at === null || $retryMissing)) {
            $updates['dropoff_geocode_attempted_at'] = now();
            if ($geocodedPickup) {
                usleep(1_100_000);
            }

            $dropoffCoords = $this->resolveSideCoordinates(
                $jobOrder,
                'dropoff',
                $dropoffAnchor,
                $this->dropoffGeocodeCandidates(
                    $jobOrder,
                    trim((string) ($jobOrder->dropoff_street ?? '')) !== '',
                ),
            );

            if ($dropoffCoords) {
                $updates = array_merge($updates, $this->coordinateUpdates('dropoff', $dropoffCoords));
                LocationPipelineLogger::log('geocode_destination_result', [
                    'job_order_id' => $jobOrder->id,
                    'lat' => $dropoffCoords['lat'],
                    'lng' => $dropoffCoords['lng'],
                ]);
            } else {
                Log::warning('Destination geocoding failed', [
                    'job_order_id' => $jobOrder->id,
                ]);
                $updates = array_merge($updates, $this->clearInvalidCoordinateColumns(
                    $jobOrder->dropoff_latitude,
                    $jobOrder->dropoff_longitude,
                    'dropoff',
                ));
            }
        } else {
            $dropoffReconcile = $this->reconcileStoredCoordinates(
                $jobOrder,
                'dropoff',
                $dropoffAnchor,
                $this->dropoffGeocodeCandidates($jobOrder, true),
            );
            if ($dropoffReconcile !== null) {
                $updates = array_merge($updates, $dropoffReconcile);
            }
        }

        $pickupReconcile = $this->reconcileStoredCoordinates(
            $jobOrder,
            'pickup',
            $pickupAnchor,
            $this->pickupGeocodeCandidates($jobOrder, true),
        );
        if ($pickupReconcile !== null) {
            $updates = array_merge($updates, $pickupReconcile);
        }

        if ($updates !== []) {
            $jobOrder->update($updates);
            $jobOrder->refresh();
        }

        return $jobOrder;
    }

    /** @return array<string, mixed> */
    public function mapPayload(JobOrder $jobOrder): array
    {
        $needsPickup = ! GpsCoordinateValidator::isUsable($jobOrder->pickup_latitude, $jobOrder->pickup_longitude);
        $needsDropoff = ! GpsCoordinateValidator::isUsable($jobOrder->dropoff_latitude, $jobOrder->dropoff_longitude);
        if ($needsPickup || $needsDropoff) {
            $jobOrder = $this->ensureCoordinates($jobOrder, retryMissing: true);
        }

        $pickupAddress = $this->resolvePickupAddress($jobOrder);
        $destinationAddress = $this->resolveDropoffAddress($jobOrder);

        $pickup = $this->point(
            $jobOrder->pickup_latitude,
            $jobOrder->pickup_longitude,
            $pickupAddress,
            'pickup',
        );

        $destination = $this->point(
            $jobOrder->dropoff_latitude,
            $jobOrder->dropoff_longitude,
            $destinationAddress,
            'destination',
        );

        if ($pickup) {
            $pickup['trace_id'] = $jobOrder->pickup_geocoding_trace_id;
        }
        if ($destination) {
            $destination['trace_id'] = $jobOrder->dropoff_geocoding_trace_id;
        }
        LocationTraceRecorder::apiDelivered($jobOrder->pickup_geocoding_trace_id, $pickup);
        LocationTraceRecorder::apiDelivered($jobOrder->dropoff_geocoding_trace_id, $destination);

        $this->warnIfDuplicateLocations($jobOrder->id, $pickup, $destination);

        $route = $this->routeBetween($pickup, $destination);
        $geocodeWarnings = $this->buildGeocodeWarnings($pickupAddress, $destinationAddress, $pickup, $destination);

        LocationPipelineLogger::log('map_payload', [
            'job_order_id' => $jobOrder->id,
            'pickup_address' => $pickupAddress,
            'destination_address' => $destinationAddress,
            'pickup' => $pickup,
            'destination' => $destination,
            'route_source' => $route['source'] ?? null,
            'distance_label' => $route['distance_label'] ?? null,
            'duration_label' => $route['duration_label'] ?? null,
            'geocode_warnings' => $geocodeWarnings,
        ]);

        return [
            'job_order_id' => $jobOrder->id,
            'pickup' => $pickup,
            'destination' => $destination,
            'route' => $route,
            'geocode' => [
                'pickup_resolved' => isset($pickup['lat'], $pickup['lng']),
                'destination_resolved' => isset($destination['lat'], $destination['lng']),
                'pickup_address' => $pickupAddress,
                'destination_address' => $destinationAddress,
                'warnings' => $geocodeWarnings,
            ],
        ];
    }

    /** @return list<string> */
    private function pickupGeocodeCandidates(JobOrder $jobOrder, bool $streetStrict = false): array
    {
        $candidates = [];

        $label = trim((string) ($jobOrder->pickup_coordinate_label ?? ''));
        if ($label !== '') {
            $candidates[] = $this->appendLandmark($label, $jobOrder->pickup_landmark);
        }

        foreach ($this->structuredStreetCandidates(
            $jobOrder->pickup_street,
            $jobOrder->pickup_barangay,
            $jobOrder->pickup_city,
            $jobOrder->pickup_province,
            $jobOrder->pickup_region,
        ) as $structured) {
            $candidates[] = $this->appendLandmark($structured, $jobOrder->pickup_landmark);
        }

        if ($streetStrict && $candidates !== []) {
            return $this->uniqueNonEmpty($candidates);
        }

        if ($jobOrder->quarry) {
            $quarryAddress = trim((string) ($jobOrder->quarry->address ?? ''));
            $quarryName = trim((string) ($jobOrder->quarry->quarry_name ?? ''));
            $display = trim($jobOrder->display_pickup);
            $legacy = trim((string) ($jobOrder->pickup_location ?? ''));

            if ($quarryAddress !== ''
                && ($display === '' || strcasecmp($display, $quarryName) === 0 || strcasecmp($legacy, $quarryName) === 0)) {
                $candidates[] = $this->appendLandmark($quarryAddress, $jobOrder->pickup_landmark);
            }
        }

        $display = trim($jobOrder->display_pickup);
        if ($display !== '') {
            $candidates[] = $this->appendLandmark($display, $jobOrder->pickup_landmark);
        }

        $legacy = trim((string) ($jobOrder->pickup_location ?? ''));
        if ($legacy !== '') {
            $candidates[] = $this->appendLandmark($legacy, $jobOrder->pickup_landmark);
        }

        if ($jobOrder->quarry) {
            $quarryName = trim((string) ($jobOrder->quarry->quarry_name ?? ''));
            if ($quarryName !== '') {
                $candidates[] = $this->appendLandmark($quarryName, $jobOrder->pickup_landmark);
            }
        }

        return $this->uniqueNonEmpty($candidates);
    }

    /** @return list<string> */
    private function dropoffGeocodeCandidates(JobOrder $jobOrder, bool $streetStrict = false): array
    {
        $candidates = [];

        $label = trim((string) ($jobOrder->dropoff_coordinate_label ?? ''));
        if ($label !== '') {
            $candidates[] = $this->appendLandmark($label, $jobOrder->dropoff_landmark);
        }

        foreach ($this->structuredStreetCandidates(
            $jobOrder->dropoff_street,
            $jobOrder->dropoff_barangay,
            $jobOrder->dropoff_city,
            $jobOrder->dropoff_province,
            $jobOrder->dropoff_region,
        ) as $structured) {
            $candidates[] = $this->appendLandmark($structured, $jobOrder->dropoff_landmark);
        }

        if ($streetStrict && $candidates !== []) {
            return $this->uniqueNonEmpty($candidates);
        }

        $display = trim($jobOrder->display_dropoff);
        if ($display !== '') {
            $candidates[] = $this->appendLandmark($display, $jobOrder->dropoff_landmark);
        }

        $legacy = trim((string) ($jobOrder->dropoff_location ?? ''));
        if ($legacy !== '') {
            $candidates[] = $this->appendLandmark($legacy, $jobOrder->dropoff_landmark);
        }

        return $this->uniqueNonEmpty($candidates);
    }

    /**
     * @return list<string>
     */
    private function structuredStreetCandidates(
        mixed $street,
        mixed $barangay,
        mixed $city,
        mixed $province,
        mixed $region,
    ): array {
        $streetText = trim((string) ($street ?? ''));
        if ($streetText === '') {
            return [];
        }

        $barangayText = trim((string) ($barangay ?? ''));
        $cityText = trim((string) ($city ?? ''));
        $provinceText = trim((string) ($province ?? ''));
        $regionText = trim((string) ($region ?? ''));
        $barangayLabel = preg_match('/^(barangay|brgy\.?\s)/i', $barangayText)
            ? $barangayText
            : ($barangayText !== '' ? 'Barangay '.$barangayText : '');

        $candidates = [];
        foreach (StreetGeocodeHelper::geocodeStreetVariants($streetText) as $streetVariant) {
            foreach ([
                JobOrderAddressFormatter::formatParts([$streetVariant, $barangayText, $cityText, $provinceText, 'Philippines']),
                JobOrderAddressFormatter::formatParts([$streetVariant, $cityText, $provinceText, 'Philippines']),
                JobOrderAddressFormatter::formatParts([$streetVariant, $cityText, 'Philippines']),
                JobOrderAddressFormatter::formatParts([$streetVariant, $barangayLabel, $cityText, $provinceText]),
                JobOrderAddressFormatter::formatParts([$streetVariant, $barangayText, $cityText, $provinceText]),
                JobOrderAddressFormatter::formatParts([$streetVariant, $barangayText, $cityText, $provinceText, $regionText]),
            ] as $formatted) {
                if ($formatted !== '') {
                    $candidates[] = $formatted;
                }
            }
        }

        foreach ([
            JobOrderAddressFormatter::formatParts([$barangayText, $cityText, $provinceText, 'Philippines']),
            JobOrderAddressFormatter::formatParts([$cityText, $provinceText, 'Philippines']),
            $cityText !== '' ? $cityText.', Philippines' : '',
        ] as $fallback) {
            if ($fallback !== '') {
                $candidates[] = $fallback;
            }
        }

        return $this->uniqueNonEmpty($candidates);
    }

    /**
     * @param  list<string>  $candidates
     * @return array{lat: float, lng: float, place_id?: string|null, formatted_address?: string|null}|null
     */
    private function resolveSideCoordinates(
        JobOrder $jobOrder,
        string $prefix,
        GeocodeAnchor $anchor,
        array $candidates,
    ): ?array {
        if ($candidates === []) {
            return null;
        }

        LocationPipelineLogger::log("geocode_{$prefix}_request", [
            'job_order_id' => $jobOrder->id,
            'candidates' => $candidates,
        ]);

        return $this->geocoder->geocodeFirstPermissive($candidates);
    }

    /**
     * @param  array{lat: float, lng: float, place_id?: string|null, formatted_address?: string|null}  $coords
     * @return array<string, mixed>
     */
    private function coordinateUpdates(string $prefix, array $coords): array
    {
        $updates = [
            "{$prefix}_latitude" => $coords['lat'],
            "{$prefix}_longitude" => $coords['lng'],
        ];

        $placeId = trim((string) ($coords['place_id'] ?? ''));
        if ($placeId !== '') {
            $updates["{$prefix}_coordinate_place_id"] = $placeId;
            $updates["{$prefix}_coordinate_provider"] = 'google_geocoding';
        }

        $formatted = trim((string) ($coords['formatted_address'] ?? ''));
        if ($formatted !== '') {
            $updates["{$prefix}_coordinate_label"] = $formatted;
            $updates["{$prefix}_formatted_address"] = $formatted;
            $updates["{$prefix}_location"] = $formatted;
        }

        return $updates;
    }

    /**
     * Replace stored coordinates when a structured street geocodes to a meaningfully different point.
     *
     * @param  list<string>  $candidates
     * @return array<string, mixed>|null
     */
    private function reconcileStoredCoordinates(
        JobOrder $jobOrder,
        string $prefix,
        GeocodeAnchor $anchor,
        array $candidates,
    ): ?array {
        $street = trim((string) ($jobOrder->{"{$prefix}_street"} ?? ''));
        if ($street === '' || $candidates === []) {
            return null;
        }

        if (! StreetGeocodeHelper::needsStreetReconcile($street)) {
            return null;
        }

        $stored = GpsCoordinateValidator::pair(
            $jobOrder->{"{$prefix}_latitude"},
            $jobOrder->{"{$prefix}_longitude"},
            "{$prefix}_reconcile",
        );
        if (! $stored) {
            return null;
        }

        $fresh = $this->geocoder->geocodeFirst($candidates, $anchor, true);
        if (! $fresh) {
            return null;
        }

        $distanceMeters = GpsCoordinateValidator::distanceMeters(
            $stored['lat'],
            $stored['lng'],
            $fresh['lat'],
            $fresh['lng'],
        );

        if ($distanceMeters <= 250) {
            return null;
        }

        LocationPipelineLogger::log('geocode_reconciled', [
            'job_order_id' => $jobOrder->id,
            'prefix' => $prefix,
            'street' => $street,
            'previous' => $stored,
            'next' => $fresh,
            'distance_meters' => $distanceMeters,
        ]);

        return [
            "{$prefix}_latitude" => $fresh['lat'],
            "{$prefix}_longitude" => $fresh['lng'],
            "{$prefix}_geocode_attempted_at" => now(),
        ];
    }

    /**
     * @param  list<string>  $values
     * @return list<string>
     */
    private function uniqueNonEmpty(array $values): array
    {
        $seen = [];
        $unique = [];

        foreach ($values as $value) {
            $value = trim($value);
            if ($value === '') {
                continue;
            }

            $key = strtolower($value);
            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $unique[] = $value;
        }

        return $unique;
    }

    /**
     * @param  array<string, mixed>|null  $pickup
     * @param  array<string, mixed>|null  $destination
     * @return list<string>
     */
    private function buildGeocodeWarnings(
        string $pickupAddress,
        string $destinationAddress,
        ?array $pickup,
        ?array $destination,
    ): array {
        $warnings = [];

        if (! isset($pickup['lat'], $pickup['lng'])) {
            $warnings[] = $pickupAddress === ''
                ? 'Pickup address is missing for this job order.'
                : "Could not map pickup location: {$pickupAddress}";
        }

        if (! isset($destination['lat'], $destination['lng'])) {
            $warnings[] = $destinationAddress === ''
                ? 'Destination address is missing for this job order.'
                : "Could not map destination location: {$destinationAddress}";
        }

        return $warnings;
    }

    private function resolvePickupAddress(JobOrder $jobOrder): string
    {
        if ($jobOrder->quarry) {
            $quarryAddress = trim((string) ($jobOrder->quarry->address ?? ''));
            $quarryName = trim((string) ($jobOrder->quarry->quarry_name ?? ''));
            $display = trim($jobOrder->display_pickup);
            $legacy = trim((string) ($jobOrder->pickup_location ?? ''));

            if ($quarryAddress !== ''
                && ($display === '' || strcasecmp($display, $quarryName) === 0 || strcasecmp($legacy, $quarryName) === 0)) {
                return $this->appendLandmark($quarryAddress, $jobOrder->pickup_landmark);
            }
        }

        $display = trim($jobOrder->display_pickup);
        if ($display !== '') {
            return $this->appendLandmark($display, $jobOrder->pickup_landmark);
        }

        $legacy = trim((string) ($jobOrder->pickup_location ?? ''));
        if ($legacy !== '') {
            return $this->appendLandmark($legacy, $jobOrder->pickup_landmark);
        }

        if ($jobOrder->quarry) {
            $quarryName = trim((string) ($jobOrder->quarry->quarry_name ?? ''));
            if ($quarryName !== '') {
                return $this->appendLandmark($quarryName, $jobOrder->pickup_landmark);
            }
        }

        return '';
    }

    private function resolveDropoffAddress(JobOrder $jobOrder): string
    {
        $display = trim($jobOrder->display_dropoff);
        if ($display !== '') {
            return $this->appendLandmark($display, $jobOrder->dropoff_landmark);
        }

        $legacy = trim((string) ($jobOrder->dropoff_location ?? ''));

        return $legacy !== ''
            ? $this->appendLandmark($legacy, $jobOrder->dropoff_landmark)
            : '';
    }

    private function appendLandmark(string $address, mixed $landmark): string
    {
        $landmarkText = trim((string) ($landmark ?? ''));
        if ($landmarkText === '' || str_contains(strtolower($address), strtolower($landmarkText))) {
            return $address;
        }

        return JobOrderAddressFormatter::formatParts([$address, $landmarkText]);
    }

    /**
     * @param  array<string, mixed>|null  $pickup
     * @param  array<string, mixed>|null  $destination
     */
    private function warnIfDuplicateLocations(int $jobOrderId, ?array $pickup, ?array $destination): void
    {
        if (! $pickup || ! $destination || ! isset($pickup['lat'], $pickup['lng'], $destination['lat'], $destination['lng'])) {
            return;
        }

        if (! GpsCoordinateValidator::areDuplicate(
            (float) $pickup['lat'],
            (float) $pickup['lng'],
            (float) $destination['lat'],
            (float) $destination['lng'],
        )) {
            return;
        }

        Log::warning('Pickup and destination coordinates are identical or too close', [
            'job_order_id' => $jobOrderId,
            'pickup' => [$pickup['lat'], $pickup['lng']],
            'destination' => [$destination['lat'], $destination['lng']],
        ]);

        LocationPipelineLogger::log('duplicate_pickup_destination', [
            'job_order_id' => $jobOrderId,
            'pickup' => $pickup,
            'destination' => $destination,
        ]);
    }

    /**
     * @return array<string, null>
     */
    private function clearInvalidCoordinateColumns(mixed $lat, mixed $lng, string $prefix): array
    {
        if ($lat === null && $lng === null) {
            return [];
        }

        if (GpsCoordinateValidator::isUsable($lat, $lng)) {
            return [];
        }

        return [
            "{$prefix}_latitude" => null,
            "{$prefix}_longitude" => null,
        ];
    }

    /** @return array<string, mixed>|null */
    private function point(mixed $lat, mixed $lng, string $address, string $kind): ?array
    {
        $pair = GpsCoordinateValidator::pair($lat, $lng, "job_order_{$kind}");
        if ($pair) {
            return [
                'kind' => $kind,
                'address' => $address,
                'lat' => $pair['lat'],
                'lng' => $pair['lng'],
            ];
        }

        // Tracking consumers must never infer map points from incomplete text.
        // Legacy text is used only by the one-time server-side geocoding pass.
        return null;
    }

    /** @param  array<string, mixed>|null  $pickup
     * @param  array<string, mixed>|null  $destination
     * @return array<string, mixed>|null
     */
    private function routeBetween(?array $pickup, ?array $destination): ?array
    {
        if (! $pickup || ! $destination
            || ! isset($pickup['lat'], $pickup['lng'], $destination['lat'], $destination['lng'])) {
            return null;
        }

        $fromLat = (float) $pickup['lat'];
        $fromLng = (float) $pickup['lng'];
        $toLat = (float) $destination['lat'];
        $toLng = (float) $destination['lng'];

        $cacheKey = sprintf(
            'deliverex.job_route.%s',
            md5(implode(':', [
                round($fromLat, 7),
                round($fromLng, 7),
                round($toLat, 7),
                round($toLng, 7),
            ])),
        );

        $route = Cache::remember(
            $cacheKey,
            now()->addDay(),
            fn () => $this->directions->route($fromLat, $fromLng, $toLat, $toLng),
        );

        LocationPipelineLogger::log('route_generated', [
            'from' => [$fromLat, $fromLng],
            'to' => [$toLat, $toLng],
            'source' => $route['source'] ?? null,
            'distance_label' => $route['distance_label'] ?? null,
            'duration_label' => $route['duration_label'] ?? null,
            'polyline_points' => is_array($route['polyline'] ?? null) ? count($route['polyline']) : 0,
        ]);

        return $route;
    }
}
