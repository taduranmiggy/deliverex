<?php

/**
 * FR 1.12–1.21 — JWT access/refresh session policy.
 *
 * Access tokens are short-lived JWTs (FR 1.13).
 * Refresh tokens are opaque, stored hashed in DB, with role-based inactivity TTLs.
 */
return [

    // HS256 signing secret — defaults to APP_KEY; set JWT_SECRET in .env to rotate independently.
    'secret' => env('JWT_SECRET', env('APP_KEY')),

    // FR 1.13 — access token lifetime (minutes).
    'access_ttl_minutes' => (int) env('JWT_ACCESS_TTL_MINUTES', 120),

    // HttpOnly cookie name for browser refresh tokens (FR 1.17).
    'refresh_cookie' => env('SESSION_REFRESH_COOKIE', 'deliverex_refresh'),

    // FR 1.14–1.16 — refresh token inactivity TTLs by role (minutes).
    'refresh_ttl_minutes' => [
        'driver'     => (int) env('JWT_REFRESH_TTL_DRIVER_MINUTES', 7 * 24 * 60),      // 7 days
        'customer'   => (int) env('JWT_REFRESH_TTL_CUSTOMER_MINUTES', 30 * 24 * 60),   // 30 days
        'admin'      => (int) env('JWT_REFRESH_TTL_STAFF_MINUTES', 24 * 60),           // 24 hours
        'manager'    => (int) env('JWT_REFRESH_TTL_STAFF_MINUTES', 24 * 60),
        'dispatcher' => (int) env('JWT_REFRESH_TTL_STAFF_MINUTES', 24 * 60),
        'default'    => (int) env('JWT_REFRESH_TTL_DEFAULT_MINUTES', 24 * 60),
    ],

    // Cookie flags for refresh token (web).
    'cookie' => [
        'path'     => '/',
        'secure'   => env('SESSION_SECURE_COOKIE', env('APP_ENV') === 'production'),
        'http_only'=> true,
        'same_site'=> env('SESSION_SAME_SITE', 'lax'),
    ],

];
