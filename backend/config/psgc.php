<?php

return [
    'base_url' => env('PSGC_API_URL', 'https://psgc.cloud/api/v2'),
    'timeout' => (int) env('PSGC_API_TIMEOUT', 12),
    'cache_ttl' => (int) env('PSGC_CACHE_TTL', 604800),
];
