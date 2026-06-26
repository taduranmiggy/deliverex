<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Models\UserSession;
use App\Services\Auth\JwtService;
use App\Services\Auth\SessionService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * FR 1.12 — authenticate API requests via JWT access token OR legacy Sanctum token.
 *
 * Migration-safe: existing Sanctum sessions continue to work until users re-login.
 */
class AuthenticateApi
{
    public function __construct(
        private readonly JwtService $jwt,
        private readonly SessionService $sessions,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        // JWT access tokens contain two dots (header.payload.signature).
        if (substr_count($token, '.') === 2) {
            return $this->authenticateJwt($request, $next, $token);
        }

        return $this->authenticateSanctum($request, $next, $token);
    }

    private function authenticateJwt(Request $request, Closure $next, string $token): Response
    {
        try {
            $claims = $this->jwt->decode($token);
        } catch (\Throwable) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $user = User::query()->with('role')->find((int) ($claims['sub'] ?? 0));
        if (! $user || ($user->status ?? 'active') !== 'active') {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $sessionId = (string) ($claims['sid'] ?? '');
        $session = $sessionId
            ? UserSession::query()->where('id', $sessionId)->where('user_id', $user->id)->first()
            : null;

        if ($session && $session->isRevoked()) {
            return response()->json(['message' => 'Session expired. Please login again.'], 401);
        }

        if ($session) {
            $this->sessions->touchSession($session->id);
        }

        Auth::setUser($user);
        $request->setUserResolver(fn () => $user);
        $request->attributes->set('auth_session_id', $sessionId);

        return $next($request);
    }

    private function authenticateSanctum(Request $request, Closure $next, string $token): Response
    {
        $accessToken = PersonalAccessToken::findToken($token);

        if (! $accessToken?->tokenable) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        if ($accessToken->expires_at && $accessToken->expires_at->isPast()) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        /** @var User $user */
        $user = $accessToken->tokenable->loadMissing('role');

        if (($user->status ?? 'active') !== 'active') {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        Auth::setUser($user);
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
