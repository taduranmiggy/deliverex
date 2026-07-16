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

    /*
    |--------------------------------------------------------------------------
    | Driver PWA update intervals (seconds) — used by frontend hook
    |--------------------------------------------------------------------------
    */
    'interval_moving_seconds' => (int) env('GPS_INTERVAL_MOVING_SECONDS', 10),
    'interval_stopped_seconds' => (int) env('GPS_INTERVAL_STOPPED_SECONDS', 45),
    'moving_speed_threshold_kmh' => (float) env('GPS_MOVING_SPEED_THRESHOLD_KMH', 3),
];
