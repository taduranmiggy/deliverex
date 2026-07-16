<?php

return [
    'company_name' => env('REPORT_COMPANY_NAME', 'Deliverex Logistics'),
    'product_name' => env('REPORT_PRODUCT_NAME', 'Deliverex'),
    'footer_text' => env('REPORT_FOOTER', 'Confidential — For internal and authorized client use only.'),
    'support_email' => env('REPORT_SUPPORT_EMAIL', 'support@deliverex.com'),

    /** Maximum rows per export (cursor/stream still used). */
    'export_max_rows' => (int) env('REPORT_EXPORT_MAX_ROWS', 10000),

    'default_timezone' => env('APP_TIMEZONE', 'Asia/Manila'),

    'document_version' => env('REPORT_DOCUMENT_VERSION', '1.0'),

    'deliveries' => [
        'date_fields' => ['assigned_at', 'started_at', 'completed_at', 'created_at'],
        'sort_fields' => ['assigned_at', 'completed_at', 'status', 'created_at'],
    ],
];
