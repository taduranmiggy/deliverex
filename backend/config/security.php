<?php

/**
 * Response security-header policy (additive hardening only).
 *
 * These settings drive App\Http\Middleware\SecurityHeaders. They do NOT change
 * authentication, routing, APIs, or the OCR/Best-Fit/tracking workflow — they
 * only attach defensive HTTP response headers. Every value can be tuned or the
 * whole layer disabled via env without code changes (escape hatch for prod).
 */
return [

    // Master switch — set SECURITY_HEADERS_ENABLED=false to disable everything.
    'enabled' => (bool) env('SECURITY_HEADERS_ENABLED', true),

    // Only emitted on HTTPS requests. Disable if running behind mixed setups.
    'hsts' => [
        'enabled' => (bool) env('SECURITY_HSTS_ENABLED', true),
        'max_age' => (int) env('SECURITY_HSTS_MAX_AGE', 31536000), // 1 year
        'include_subdomains' => (bool) env('SECURITY_HSTS_INCLUDE_SUBDOMAINS', true),
    ],

    /*
     * Content-Security-Policy.
     *
     * Tuned for the deployed Deliverex SPA:
     *  - script-src 'self'  — the built index.html has NO inline scripts (only
     *    hashed module bundles), so this gives real XSS protection safely.
     *  - style-src 'unsafe-inline' — React/inline style props + Google Fonts CSS.
     *  - img-src blob:/data: — OCR document previews and XLSX export object URLs.
     *  - OpenStreetMap tile hosts for the Leaflet fleet map.
     *  - worker-src — the customer PWA service worker (/sw.js).
     *
     * Set SECURITY_CSP in env to override the whole policy string if needed.
     */
    'csp' => env('SECURITY_CSP', implode('; ', [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'self'",
        "form-action 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.openstreetmap.org",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "frame-src 'self'",
    ])),

    // Additional static headers. Permissions-Policy keeps geolocation + camera
    // for driver GPS tracking and photo capture; everything else is denied.
    'headers' => [
        'X-Frame-Options' => 'SAMEORIGIN',
        'X-Content-Type-Options' => 'nosniff',
        'Referrer-Policy' => 'strict-origin-when-cross-origin',
        'Permissions-Policy' => 'geolocation=(self), camera=(self), microphone=(), payment=(), usb=()',
        'Cross-Origin-Opener-Policy' => 'same-origin',
    ],

];
