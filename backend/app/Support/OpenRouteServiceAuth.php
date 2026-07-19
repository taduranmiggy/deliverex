<?php

namespace App\Support;

final class OpenRouteServiceAuth
{
    /**
     * @return array{Authorization: string}|null
     */
    public static function authorizationHeader(?string $apiKey): ?array
    {
        $apiKey = trim((string) $apiKey);
        if ($apiKey === '') {
            return null;
        }

        if (! str_starts_with($apiKey, 'Bearer ')) {
            $apiKey = 'Bearer '.$apiKey;
        }

        return ['Authorization' => $apiKey];
    }
}
