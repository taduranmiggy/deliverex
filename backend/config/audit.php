<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Module labels (action prefix → display name)
    |--------------------------------------------------------------------------
    */
    'modules' => [
        'auth' => 'Auth',
        'dashboard' => 'Dashboard',
        'user' => 'User Management',
        'company' => 'Company Management',
        'customer' => 'Customer Management',
        'job_order' => 'Job Orders',
        'dispatch' => 'Fleet Dispatch',
        'calendar' => 'Calendar',
        'tracking' => 'Tracking',
        'delivery' => 'Delivery Workflow',
        'document' => 'Documents',
        'ocr' => 'OCR Review',
        'gps' => 'GPS',
        'offline' => 'Offline Sync',
        'notification' => 'Notifications',
        'inquiry' => 'Support Inquiries',
        'support' => 'Support / Chatbox',
        'analytics' => 'Analytics',
        'email' => 'Email Monitoring',
        'system' => 'System Logs',
        'reports' => 'Reports',
        'settings' => 'Settings',
        'profile' => 'Profile Management',
        'chatbot_intent' => 'Support / Chatbox',
        'driver' => 'Driver Management',
        'vehicle' => 'Vehicle Management',
        'fleet' => 'Fleet Dispatch',
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
