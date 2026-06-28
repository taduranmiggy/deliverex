<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'document_ai' => [
        'credentials' => env('GOOGLE_APPLICATION_CREDENTIALS', 'storage/app/google/document-ai.json'),
        'project' => env('GOOGLE_CLOUD_PROJECT'),
        'location' => env('DOCUMENT_AI_LOCATION', 'us'),
        'processor_id' => env('DOCUMENT_AI_PROCESSOR_ID'),
        'timeout' => (int) env('DOCUMENT_AI_TIMEOUT', 30),
        'retries' => (int) env('DOCUMENT_AI_RETRIES', 1),
        // Use REST on shared hosting (Hostinger etc.) — gRPC often hangs without ext-grpc.
        'transport' => env('DOCUMENT_AI_TRANSPORT', 'rest'),
    ],

];
