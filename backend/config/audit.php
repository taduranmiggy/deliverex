<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Module labels (action prefix → display name)
    |--------------------------------------------------------------------------
    */
    'modules' => [
        'auth' => 'Auth',
        'user' => 'User Management',
        'company' => 'Company Management',
        'job_order' => 'Job Orders',
        'dispatch' => 'Dispatch',
        'delivery' => 'Delivery Workflow',
        'document' => 'Documents',
        'ocr' => 'OCR',
        'gps' => 'GPS',
        'offline' => 'Offline Sync',
        'inquiry' => 'Inquiries',
        'reports' => 'Reports',
        'settings' => 'Settings',
        'chatbot_intent' => 'Chatbot',
        'driver' => 'Drivers',
        'vehicle' => 'Vehicles',
        'fleet' => 'Fleet',
    ],

    /*
    |--------------------------------------------------------------------------
    | Fields never stored in audit change diffs
    |--------------------------------------------------------------------------
    */
    'redact_fields' => [
        'password',
        'password_confirmation',
        'current_password',
        'token',
        'refresh_token',
        'remember_token',
    ],
];
