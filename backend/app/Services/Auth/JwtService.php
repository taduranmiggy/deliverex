<?php

namespace App\Services\Auth;

use Illuminate\Support\Str;
use UnexpectedValueException;

/**
 * FR 1.12 / FR 1.13 — JWT access token encoder/decoder (HS256, 2-hour TTL).
 */
class JwtService
{
    public function issueAccessToken(int $userId, string $role, string $sessionId): array
    {
        $ttlMinutes = (int) config('session_auth.access_ttl_minutes', 120);
        $now = time();
        $exp = $now + ($ttlMinutes * 60);

        $payload = [
            'iss' => config('app.url', 'deliverex'),
            'sub' => $userId,
            'role' => $role,
            'sid' => $sessionId,
            'iat' => $now,
            'exp' => $exp,
            'jti' => (string) Str::uuid(),
        ];

        return [
            'token' => $this->encode($payload),
            'expires_at' => $exp,
            'expires_in' => $ttlMinutes * 60,
        ];
    }

    /**
     * @return array{sub:int,role:string,sid:string,exp:int}
     */
    public function decode(string $token): array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new UnexpectedValueException('Malformed JWT');
        }

        [$headerB64, $payloadB64, $sigB64] = $parts;
        $expected = $this->base64UrlEncode(hash_hmac('sha256', "{$headerB64}.{$payloadB64}", $this->secret(), true));

        if (! hash_equals($expected, $sigB64)) {
            throw new UnexpectedValueException('Invalid JWT signature');
        }

        $payload = json_decode($this->base64UrlDecode($payloadB64), true, 512, JSON_THROW_ON_ERROR);

        if (! isset($payload['exp']) || time() >= (int) $payload['exp']) {
            throw new UnexpectedValueException('Token expired');
        }

        return $payload;
    }

    private function encode(array $payload): string
    {
        $header = $this->base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256'], JSON_THROW_ON_ERROR));
        $body = $this->base64UrlEncode(json_encode($payload, JSON_THROW_ON_ERROR));
        $signature = $this->base64UrlEncode(hash_hmac('sha256', "{$header}.{$body}", $this->secret(), true));

        return "{$header}.{$body}.{$signature}";
    }

    private function secret(): string
    {
        return (string) config('session_auth.secret');
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }

        return base64_decode(strtr($data, '-_', '+/'), true) ?: '';
    }
}
