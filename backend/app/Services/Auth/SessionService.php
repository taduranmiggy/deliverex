<?php

namespace App\Services\Auth;

use App\Models\DriverDeviceSession;
use App\Models\RefreshToken;
use App\Models\User;
use App\Models\UserSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * FR 1.12–1.21 — refresh token lifecycle, role TTLs, driver single-device, revocation.
 */
class SessionService
{
    public function __construct(private readonly JwtService $jwt) {}

    /**
     * Create session + refresh token + JWT access token after successful login.
     *
     * @return array{access_token:string,refresh_token:string,expires_in:int,session_id:string,user_session:UserSession}
     */
    public function createSession(User $user, Request $request): array
    {
        $role = (string) ($user->role?->name ?? 'default');
        $deviceId = $this->normalizeDeviceId($request->input('device_id'));
        $platform = $this->normalizePlatform($request->input('platform'), $request);

        return DB::transaction(function () use ($user, $request, $role, $deviceId, $platform) {
            // FR 1.19 — invalidate other driver device sessions before creating a new one.
            if ($role === 'driver' && $deviceId) {
                $this->invalidateOtherDriverDevices($user->id, $deviceId);
            }

            $session = UserSession::query()->create([
                'user_id' => $user->id,
                'device_id' => $deviceId,
                'device_label' => $request->input('device_label'),
                'platform' => $platform,
                'ip_address' => $request->ip(),
                'user_agent' => Str::limit((string) $request->userAgent(), 500, ''),
                'last_active_at' => now(),
                'is_active' => true,
            ]);

            [$plainRefresh, $refreshModel] = $this->storeRefreshToken($session, $role);

            if ($role === 'driver' && $deviceId) {
                DriverDeviceSession::query()->updateOrCreate(
                    ['driver_user_id' => $user->id, 'device_id' => $deviceId],
                    [
                        'user_session_id' => $session->id,
                        'refresh_token_id' => $refreshModel->id,
                        'last_active_at' => now(),
                        'is_active' => true,
                    ],
                );
            }

            $access = $this->jwt->issueAccessToken($user->id, $role, $session->id);

            return [
                'access_token' => $access['token'],
                'refresh_token' => $plainRefresh,
                'expires_in' => $access['expires_in'],
                'session_id' => $session->id,
                'user_session' => $session,
            ];
        });
    }

    /**
     * FR 1.13 / FR 1.21 — rotate refresh token and issue a new access JWT.
     */
    public function refreshSession(string $plainRefreshToken, Request $request): array
    {
        $hash = hash('sha256', $plainRefreshToken);

        $refresh = RefreshToken::query()
            ->where('token_hash', $hash)
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->first();

        if (! $refresh) {
            throw new \RuntimeException('Refresh token invalid or expired', 401);
        }

        $session = UserSession::query()
            ->with('user.role')
            ->find($refresh->user_session_id);

        if (! $session || $session->isRevoked()) {
            $this->revokeRefreshToken($refresh);
            throw new \RuntimeException('Session revoked', 401);
        }

        $user = $session->user;
        if (! $user || ($user->status ?? 'active') !== 'active') {
            $this->revokeAllForUser($user?->id ?? 0);
            throw new \RuntimeException('Account is not active', 403);
        }

        $role = (string) ($user->role?->name ?? 'default');
        $inactivityMinutes = $this->refreshTtlMinutes($role);

        // FR 1.14–1.16 — inactivity window based on last_active_at.
        if ($session->last_active_at && $session->last_active_at->lt(now()->subMinutes($inactivityMinutes))) {
            $this->revokeSession($session);
            throw new \RuntimeException('Session expired due to inactivity', 401);
        }

        return DB::transaction(function () use ($session, $refresh, $user, $role, $request) {
            $this->revokeRefreshToken($refresh);

            $session->forceFill(['last_active_at' => now()])->save();

            [$plainRefresh, $refreshModel] = $this->storeRefreshToken($session, $role, $refresh->id);

            if ($role === 'driver' && $session->device_id) {
                DriverDeviceSession::query()
                    ->where('driver_user_id', $user->id)
                    ->where('device_id', $session->device_id)
                    ->update([
                        'refresh_token_id' => $refreshModel->id,
                        'last_active_at' => now(),
                        'is_active' => true,
                    ]);
            }

            $access = $this->jwt->issueAccessToken($user->id, $role, $session->id);

            return [
                'access_token' => $access['token'],
                'refresh_token' => $plainRefresh,
                'expires_in' => $access['expires_in'],
                'session_id' => $session->id,
                'user' => $user,
            ];
        });
    }

    /** FR 1.18 — logout current session. */
    public function revokeCurrentSession(?User $user, ?string $sessionId): void
    {
        if (! $user) {
            return;
        }

        if ($sessionId) {
            $session = UserSession::query()
                ->where('id', $sessionId)
                ->where('user_id', $user->id)
                ->first();
            if ($session) {
                $this->revokeSession($session);
            }
        }

        // Legacy Sanctum tokens — keep backward compatibility during migration.
        $user->tokens()->delete();
    }

    /** FR 1.18 — admin deactivation / global revoke. */
    public function revokeAllForUser(int $userId): void
    {
        if ($userId <= 0) {
            return;
        }

        $sessions = UserSession::query()->where('user_id', $userId)->where('is_active', true)->get();
        foreach ($sessions as $session) {
            $this->revokeSession($session);
        }

        User::query()->find($userId)?->tokens()->delete();

        DriverDeviceSession::query()
            ->where('driver_user_id', $userId)
            ->update(['is_active' => false, 'last_active_at' => now()]);
    }

    public function touchSession(string $sessionId): void
    {
        UserSession::query()
            ->where('id', $sessionId)
            ->where('is_active', true)
            ->update(['last_active_at' => now()]);
    }

    public function sessionPayload(User $user, ?string $sessionId): array
    {
        $role = (string) ($user->role?->name ?? 'default');
        $session = $sessionId
            ? UserSession::query()->where('id', $sessionId)->where('user_id', $user->id)->first()
            : null;

        return [
            'session_id' => $session?->id,
            'role' => $role,
            'access_expires_in_minutes' => (int) config('session_auth.access_ttl_minutes', 120),
            'refresh_inactivity_minutes' => $this->refreshTtlMinutes($role),
            'last_active_at' => $session?->last_active_at?->toIso8601String(),
            'device_id' => $session?->device_id,
            'platform' => $session?->platform,
            'active_sessions' => UserSession::query()
                ->where('user_id', $user->id)
                ->where('is_active', true)
                ->count(),
        ];
    }

    /** HttpOnly cookie for browser refresh storage (FR 1.17). */
    public function makeRefreshCookie(string $plainRefreshToken, string $role): Cookie
    {
        $minutes = $this->refreshTtlMinutes($role);
        $cfg = config('session_auth.cookie');

        return cookie(
            config('session_auth.refresh_cookie'),
            $plainRefreshToken,
            $minutes,
            $cfg['path'] ?? '/',
            null,
            (bool) ($cfg['secure'] ?? true),
            (bool) ($cfg['http_only'] ?? true),
            false,
            $cfg['same_site'] ?? 'lax',
        );
    }

    public function forgetRefreshCookie(): Cookie
    {
        $cfg = config('session_auth.cookie');

        return cookie(
            config('session_auth.refresh_cookie'),
            '',
            -1,
            $cfg['path'] ?? '/',
            null,
            (bool) ($cfg['secure'] ?? true),
            (bool) ($cfg['http_only'] ?? true),
            false,
            $cfg['same_site'] ?? 'lax',
        );
    }

    private function storeRefreshToken(UserSession $session, string $role, ?int $rotatedFrom = null): array
    {
        $plain = Str::random(80);
        $minutes = $this->refreshTtlMinutes($role);

        $model = RefreshToken::query()->create([
            'user_session_id' => $session->id,
            'token_hash' => hash('sha256', $plain),
            'expires_at' => now()->addMinutes($minutes),
            'rotated_from_id' => $rotatedFrom,
        ]);

        return [$plain, $model];
    }

    private function revokeSession(UserSession $session): void
    {
        $session->forceFill([
            'is_active' => false,
            'revoked_at' => now(),
        ])->save();

        RefreshToken::query()
            ->where('user_session_id', $session->id)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);

        DriverDeviceSession::query()
            ->where('user_session_id', $session->id)
            ->update(['is_active' => false]);
    }

    private function revokeRefreshToken(RefreshToken $token): void
    {
        $token->forceFill(['revoked_at' => now()])->save();
    }

    private function invalidateOtherDriverDevices(int $driverUserId, string $currentDeviceId): void
    {
        $otherSessions = DriverDeviceSession::query()
            ->with('userSession')
            ->where('driver_user_id', $driverUserId)
            ->where('device_id', '!=', $currentDeviceId)
            ->where('is_active', true)
            ->get();

        foreach ($otherSessions as $deviceSession) {
            if ($deviceSession->userSession) {
                $this->revokeSession($deviceSession->userSession);
            }
            $deviceSession->forceFill(['is_active' => false])->save();
        }
    }

    private function refreshTtlMinutes(string $role): int
    {
        $map = config('session_auth.refresh_ttl_minutes', []);

        return (int) ($map[$role] ?? $map['default'] ?? 1440);
    }

    private function normalizeDeviceId(mixed $deviceId): ?string
    {
        if (! is_string($deviceId) || trim($deviceId) === '') {
            return null;
        }

        return Str::limit(trim($deviceId), 64, '');
    }

    private function normalizePlatform(mixed $platform, Request $request): string
    {
        $value = is_string($platform) ? strtolower(trim($platform)) : '';
        if (in_array($value, ['web', 'pwa', 'mobile'], true)) {
            return $value;
        }

        $ua = strtolower((string) $request->userAgent());
        if (str_contains($ua, 'wv') || str_contains($ua, 'android')) {
            return 'mobile';
        }

        return 'web';
    }
}
