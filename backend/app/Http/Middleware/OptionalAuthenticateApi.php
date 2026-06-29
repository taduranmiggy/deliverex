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

/** Sets the authenticated user when a valid token is present; never blocks guests. */
class OptionalAuthenticateApi
{
    public function __construct(
        private readonly JwtService $jwt,
        private readonly SessionService $sessions,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return $next($request);
        }

        if (substr_count($token, '.') === 2) {
            $this->tryJwt($request, $token);
        } else {
            $this->trySanctum($request, $token);
        }

        return $next($request);
    }

    private function tryJwt(Request $request, string $token): void
    {
        try {
            $claims = $this->jwt->decode($token);
        } catch (\Throwable) {
            return;
        }

        $user = User::query()->with('role')->find((int) ($claims['sub'] ?? 0));
        if (! $user || ($user->status ?? 'active') !== 'active') {
            return;
        }

        $sessionId = (string) ($claims['sid'] ?? '');
        $session = $sessionId
            ? UserSession::query()->where('id', $sessionId)->where('user_id', $user->id)->first()
            : null;

        if ($session && $session->isRevoked()) {
            return;
        }

        if ($session) {
            $this->sessions->touchSession($session->id);
        }

        Auth::setUser($user);
        $request->setUserResolver(fn () => $user);
        $request->attributes->set('auth_session_id', $sessionId);
    }

    private function trySanctum(Request $request, string $token): void
    {
        $accessToken = PersonalAccessToken::findToken($token);

        if (! $accessToken?->tokenable) {
            return;
        }

        if ($accessToken->expires_at && $accessToken->expires_at->isPast()) {
            return;
        }

        /** @var User $user */
        $user = $accessToken->tokenable->loadMissing('role');

        if (($user->status ?? 'active') !== 'active') {
            return;
        }

        Auth::setUser($user);
        $request->setUserResolver(fn () => $user);
    }
}
