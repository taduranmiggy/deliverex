<?php

return [
    /*
    |--------------------------------------------------------------------------
    | GPS coordinate validation
    |--------------------------------------------------------------------------
    */
    'min_latitude' => -90.0,
    'max_latitude' => 90.0,
    'min_longitude' => -180.0,
    'max_longitude' => 180.0,

    /** Reject null-island and near-zero drift coordinates. */
    'reject_near_zero' => true,
    'near_zero_threshold' => 0.0001,

    /*
    |--------------------------------------------------------------------------
    | Deduplication & movement filters
    |--------------------------------------------------------------------------
    */
    /** Skip writes when the driver has not moved at least this many meters. */
    'min_movement_meters' => (float) env('GPS_MIN_MOVEMENT_METERS', 15),

    /** Treat coordinates within this radius as duplicates within the time window. */
    'duplicate_radius_meters' => (float) env('GPS_DUPLICATE_RADIUS_METERS', 10),

    'duplicate_window_seconds' => (int) env('GPS_DUPLICATE_WINDOW_SECONDS', 30),

    /*
    |--------------------------------------------------------------------------
    | Impossible movement / GPS drift
    |--------------------------------------------------------------------------
    */
    'max_speed_kmh' => (float) env('GPS_MAX_SPEED_KMH', 180),

    /*
    |--------------------------------------------------------------------------
    | Staleness thresholds (for API consumers)
    |--------------------------------------------------------------------------
    */
    'stale_after_minutes' => (int) env('GPS_STALE_AFTER_MINUTES', 15),

    'critical_stale_after_minutes' => (int) env('GPS_CRITICAL_STALE_AFTER_MINUTES', 45),

    /** Seconds without a ping before showing "Driver temporarily offline." */
    'offline_after_seconds' => (int) env('GPS_OFFLINE_AFTER_SECONDS', 120),

    /** Seconds without a ping before showing "GPS signal lost." */
    'gps_lost_after_seconds' => (int) env('GPS_LOST_AFTER_SECONDS', 300),

    /** Recommended polling interval for dispatcher/customer maps (seconds). */
    'poll_interval_seconds' => (int) env('GPS_POLL_INTERVAL_SECONDS', 30),

    /*
    |--------------------------------------------------------------------------
    | Driver PWA update intervals (seconds) — used by frontend hook
    |--------------------------------------------------------------------------
    */
    'interval_moving_seconds' => (int) env('GPS_INTERVAL_MOVING_SECONDS', 60),
    'interval_stopped_seconds' => (int) env('GPS_INTERVAL_STOPPED_SECONDS', 60),
    'moving_speed_threshold_kmh' => (float) env('GPS_MOVING_SPEED_THRESHOLD_KMH', 3),

    /*
    |--------------------------------------------------------------------------
    | Road routing (OpenRouteService → OSRM → straight line fallback)
    |--------------------------------------------------------------------------
    */
    'routing' => [
        'openrouteservice_api_key' => env('OPENROUTESERVICE_API_KEY'),
        'openrouteservice_url' => env('OPENROUTESERVICE_URL', 'https://api.openrouteservice.org/v2/directions/driving-car'),
    ],

    /** Log geocode, GPS, routing stages when true (debug only). */
    'debug_pipeline' => filter_var(env('GPS_DEBUG_PIPELINE', false), FILTER_VALIDATE_BOOL),

    /** Restrict job-order / map coordinates to Philippines bounding box. */
    'philippines_bounds' => [
        'enabled' => filter_var(env('GPS_PHILIPPINES_BOUNDS', true), FILTER_VALIDATE_BOOL),
        'min_lat' => 4.5,
        'max_lat' => 21.5,
        'min_lng' => 116.0,
        'max_lng' => 127.5,
    ],
];
