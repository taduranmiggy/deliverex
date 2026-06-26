<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Models\JobOrder;
use App\Support\AuditLogger;
use App\Support\DriverAccount;
use App\Services\Auth\SessionService;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly SessionService $sessions) {}

    /**
     * FR 1.12 — login issues JWT access token + refresh token (role-based TTL).
     * Preserves existing response shape: { token, user } for all clients.
     */
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'device_id' => 'nullable|string|max:64',
            'device_label' => 'nullable|string|max:120',
            'platform' => 'nullable|in:web,pwa,mobile',
        ]);

        $user = User::query()->where('email', $credentials['email'])->first();

        if ($user && $user->locked_until && $user->locked_until->isFuture()) {
            return response()->json([
                'message' => 'Account temporarily locked due to repeated failed sign-ins.',
                'retry_after' => $user->locked_until->toIso8601String(),
            ], 423);
        }

        if ($user && $user->locked_until && $user->locked_until->isPast()) {
            $user->forceFill([
                'locked_until' => null,
                'failed_login_attempts' => 0,
            ])->save();
        }

        if (! Auth::attempt(['email' => $credentials['email'], 'password' => $credentials['password']])) {
            if ($user) {
                $maxAttempts = config('auth.max_login_attempts', 5);
                $lockMinutes = config('auth.lockout_minutes', 30);
                $attempts = (int) ($user->failed_login_attempts ?? 0) + 1;

                if ($attempts >= $maxAttempts) {
                    $user->forceFill([
                        'failed_login_attempts' => 0,
                        'locked_until' => now()->addMinutes($lockMinutes),
                    ])->save();
                } else {
                    $user->forceFill([
                        'failed_login_attempts' => $attempts,
                    ])->save();
                }
            }

            AuditLogger::record($user, 'auth.login_failed', User::class, $user?->id, [
                'email' => $credentials['email'],
            ], $request);

            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $user = $request->user();
        $user->load('role');
        $user->forceFill([
            'failed_login_attempts' => 0,
            'locked_until' => null,
        ])->save();

        if (($user->status ?? 'active') !== 'active') {
            return response()->json(['message' => 'Account is not active'], 403);
        }

        if ($user->role?->name === 'customer') {
            $this->linkCustomerJobOrdersByEmail($user);
        }

        // Issue JWT session (replaces Sanctum token for new logins).
        $issued = $this->sessions->createSession($user, $request);
        $role = (string) ($user->role?->name ?? 'default');

        AuditLogger::record($user, 'auth.login_success', User::class, $user->id, [
            'session_id' => $issued['session_id'],
        ], $request);

        $this->prepareUserPayload($user);

        $platform = $credentials['platform'] ?? 'web';
        $payload = [
            // Backward-compatible key used by all existing login pages.
            'token' => $issued['access_token'],
            'access_token' => $issued['access_token'],
            'expires_in' => $issued['expires_in'],
            'session_id' => $issued['session_id'],
            'user' => $user,
        ];

        // FR 1.17 — PWA/mobile clients receive refresh token in body for encrypted storage.
        if (in_array($platform, ['pwa', 'mobile'], true)) {
            $payload['refresh_token'] = $issued['refresh_token'];
        }

        $response = response()->json($payload);

        // FR 1.17 — browser clients store refresh token in HttpOnly cookie.
        if ($platform === 'web' || $platform === 'pwa') {
            return $response->withCookie($this->sessions->makeRefreshCookie($issued['refresh_token'], $role));
        }

        return $response;
    }

    /**
     * FR 1.13 / FR 1.21 — silent refresh using HttpOnly cookie or body refresh_token.
     */
    public function refresh(Request $request)
    {
        $plain = $request->cookie(config('session_auth.refresh_cookie'))
            ?? $request->input('refresh_token');

        if (! is_string($plain) || $plain === '') {
            return response()->json(['message' => 'Refresh token required'], 401);
        }

        try {
            $result = $this->sessions->refreshSession($plain, $request);
        } catch (\RuntimeException $e) {
            $code = $e->getCode() >= 400 && $e->getCode() < 600 ? (int) $e->getCode() : 401;

            return response()->json(['message' => $e->getMessage()], $code)
                ->withCookie($this->sessions->forgetRefreshCookie());
        }

        $role = (string) ($result['user']->role?->name ?? 'default');
        $this->prepareUserPayload($result['user']);

        $payload = [
            'token' => $result['access_token'],
            'access_token' => $result['access_token'],
            'expires_in' => $result['expires_in'],
            'session_id' => $result['session_id'],
            'user' => $result['user'],
        ];

        $platform = $request->input('platform', 'web');
        if (in_array($platform, ['pwa', 'mobile'], true)) {
            $payload['refresh_token'] = $result['refresh_token'];
        }

        return $response->withCookie($this->sessions->makeRefreshCookie($result['refresh_token'], $role));
    }

    /** FR 1.18 — logout revokes current JWT session + legacy Sanctum tokens. */
    public function logout(Request $request)
    {
        $user = $request->user();
        $sessionId = $request->attributes->get('auth_session_id');

        $this->sessions->revokeCurrentSession($user, is_string($sessionId) ? $sessionId : null);

        AuditLogger::record($user, 'auth.logout', User::class, $user?->id, [], $request);

        return response()->json(['message' => 'Logged out'])
            ->withCookie($this->sessions->forgetRefreshCookie());
    }

    /** FR 1.18 — revoke a specific session or all sessions for the user. */
    public function revoke(Request $request)
    {
        $data = $request->validate([
            'session_id' => 'nullable|uuid',
            'all' => 'nullable|boolean',
        ]);

        $user = $request->user();

        if (! empty($data['all'])) {
            $this->sessions->revokeAllForUser($user->id);
        } elseif (! empty($data['session_id'])) {
            $this->sessions->revokeCurrentSession($user, $data['session_id']);
        } else {
            $sessionId = $request->attributes->get('auth_session_id');
            $this->sessions->revokeCurrentSession($user, is_string($sessionId) ? $sessionId : null);
        }

        return response()->json(['message' => 'Session revoked']);
    }

    /** GET /auth/session — current session metadata for timeout warnings. */
    public function session(Request $request)
    {
        $user = $request->user();
        $sessionId = $request->attributes->get('auth_session_id');

        return response()->json(
            $this->sessions->sessionPayload($user, is_string($sessionId) ? $sessionId : null),
        );
    }

    public function registerCustomer(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|max:255|unique:users,email',
            'phone' => 'nullable|string|max:50',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $role = Role::query()->where('name', 'customer')->firstOrFail();

        $user = User::query()->create([
            'role_id' => $role->id,
            'name' => $data['name'],
            'email' => Str::lower($data['email']),
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'],
            'status' => 'pending',
        ]);

        JobOrder::query()
            ->whereNull('customer_user_id')
            ->where('customer_email', $user->email)
            ->update(['customer_user_id' => $user->id]);

        $user->sendEmailVerificationNotification();

        AuditLogger::record($user, 'auth.register_customer', User::class, $user->id, [], $request);

        return response()->json([
            'message' => 'Verification email sent. Please verify your email to activate your account.',
            'user' => $user->load('role'),
        ], 201);
    }

    public function verifyEmail(Request $request, int $id, string $hash)
    {
        $user = User::query()->findOrFail($id);

        if (! hash_equals((string) $hash, sha1($user->getEmailForVerification()))) {
            throw ValidationException::withMessages([
                'email' => ['Invalid verification link.'],
            ]);
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
            $user->forceFill(['status' => 'active'])->save();
            event(new Verified($user));
        }

        return response()->json([
            'message' => 'Email verified successfully. You can now log in.',
        ]);
    }

    public function resendVerification(Request $request)
    {
        $payload = $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::query()->where('email', $payload['email'])->first();

        if ($user && ! $user->hasVerifiedEmail()) {
            $user->sendEmailVerificationNotification();
        }

        return response()->json([
            'message' => 'If the email exists, a verification link has been sent.',
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        if ($user) {
            $this->prepareUserPayload($user);
        }

        return response()->json($user);
    }

    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->forceFill([
            'password' => $data['password'],
            'must_change_password' => false,
            'password_changed_at' => now(),
        ])->save();

        AuditLogger::record($user, 'auth.password_changed', User::class, $user->id, [], $request);

        $this->prepareUserPayload($user);

        return response()->json([
            'message' => 'Password updated successfully.',
            'user' => $user,
        ]);
    }

    private function linkCustomerJobOrdersByEmail(User $user): void
    {
        JobOrder::query()
            ->whereNull('customer_user_id')
            ->where('customer_email', $user->email)
            ->update(['customer_user_id' => $user->id]);
    }

    private function prepareUserPayload(User $user): void
    {
        $user->load('role');

        if ($user->role?->name === 'driver') {
            DriverAccount::resolve($user);
        }

        $user->load([
            'driver.currentAssignment.jobOrder',
            'driver.currentAssignment.vehicle',
        ]);
    }
}
