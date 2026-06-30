<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Arrival verification radius (meters)
    |--------------------------------------------------------------------------
    | Driver GPS must be within this distance of the drop-off destination
    | to mark a delivery as "Arrived".
    */
    'arrival_radius_meters' => (int) env('ARRIVAL_RADIUS_METERS', 300),

    /*
    |--------------------------------------------------------------------------
    | Average travel speed for customer ETA (km/h)
    |--------------------------------------------------------------------------
    */
    'average_travel_speed_kmh' => (float) env('AVERAGE_TRAVEL_SPEED_KMH', 30),
];
