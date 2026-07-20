<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Models\JobOrder;
use App\Models\Company;
use App\Support\CompanyAddressHelper;
use App\Support\AuditLogger;
use App\Support\DriverAccount;
use App\Services\Auth\SessionService;
use App\Services\Address\StandardizedAddressService;
use App\Services\Company\CompanyService;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly SessionService $sessions,
        private readonly CompanyService $companies,
        private readonly StandardizedAddressService $addresses,
    ) {}

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

        if (($user->status ?? 'active') === 'pending') {
            return response()->json(['message' => 'Account invitation is pending. Check your email to activate your account.'], 403);
        }

        if (($user->status ?? 'active') !== 'active') {
            return response()->json(['message' => 'Account is not active'], 403);
        }

        if ($user->role?->name === 'customer') {
            $membership = $user->companyUser()->with('company')->first();

            if (! $membership) {
                $company = Company::query()
                    ->whereRaw('LOWER(company_email) = ?', [strtolower(trim($user->email))])
                    ->first();

                if ($company?->isActive()) {
                    $membership = $this->companies->ensureOwnerMembership($company, $user);
                    $membership?->load('company');
                }
            }

            if (! $membership || ! $membership->is_active) {
                return response()->json(['message' => 'Company account is not active. Contact your administrator.'], 403);
            }
            if (! $membership->company?->isActive()) {
                return response()->json(['message' => 'Company is not active.'], 403);
            }
            $membership->forceFill(['last_login' => now()])->save();
            $this->linkCustomerJobOrdersByCompany($user, $membership->company_id);
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

        $response = response()->json($payload);

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

        AuditLogger::record($user, 'auth.session_revoked', User::class, $user->id, [
            'all' => (bool) ($data['all'] ?? false),
            'session_id' => $data['session_id'] ?? $request->attributes->get('auth_session_id'),
        ], $request);

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

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $email = strtolower(trim($request->input('email')));
        Password::sendResetLink(['email' => $email]);

        AuditLogger::record(null, 'auth.password_reset_requested', User::class, null, [
            'email' => $email,
        ], $request);

        return response()->json([
            'message' => 'If the email exists, a password reset link has been sent.',
        ]);
    }

    public function passwordResetContext(Request $request)
    {
        $user = $this->resolvePasswordBrokerUser($request, brokers: ['users']);

        return response()->json([
            'email' => $user->email,
        ]);
    }

    public function accountActivationContext(Request $request)
    {
        $user = $this->resolvePasswordBrokerUser($request, brokers: ['invitations', 'users']);
        $user->load(['role', 'companyUser.company']);
        $company = $user->companyUser?->company;

        return response()->json([
            'email' => $user->email,
            'needs_company_address' => $user->role?->name === 'customer'
                && $company
                && ! CompanyAddressHelper::hasStructuredAddress($company),
            'company_name' => $company?->company_name,
        ]);
    }

    /**
     * @param  list<string>  $brokers
     */
    private function resolvePasswordBrokerUser(Request $request, array $brokers = ['users']): User
    {
        $payload = $request->validate([
            'email' => 'required|email',
            'token' => 'required|string',
        ]);

        $email = strtolower(trim((string) $payload['email']));
        $token = trim((string) $payload['token']);

        $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();
        if (! $user) {
            throw ValidationException::withMessages([
                'token' => ['Invalid or expired activation link. Ask your administrator to resend the invite.'],
            ]);
        }

        foreach ($brokers as $broker) {
            if (Password::broker($broker)->tokenExists($user, $token)) {
                return $user;
            }
        }

        throw ValidationException::withMessages([
            'token' => ['Invalid or expired activation link. Ask your administrator to resend the invite from User Management.'],
        ]);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
            'email' => 'required|email',
            'password' => [
                'required',
                'string',
                'confirmed',
                PasswordRule::min(8)->mixedCase()->numbers()->symbols(),
            ],
            'company_address' => 'nullable|array',
            'company_address.region_code' => 'required_with:company_address|nullable|string|size:10',
            'company_address.province_code' => 'nullable|string|size:10',
            'company_address.city_code' => 'required_with:company_address|nullable|string|size:10',
            'company_address.barangay_code' => 'required_with:company_address|nullable|string|size:10',
            'company_address.street' => 'required_with:company_address|nullable|string|max:255',
        ]);

        $email = strtolower(trim((string) $request->input('email')));
        $token = trim((string) $request->input('token'));
        $request->merge(['email' => $email, 'token' => $token]);

        $companyAddress = $request->input('company_address');
        $normalizedCompanyAddress = null;
        if (is_array($companyAddress)) {
            $normalizedCompanyAddress = $this->addresses->normalizeEntityAddress([
                'address_region_code' => $companyAddress['region_code'] ?? null,
                'address_province_code' => $companyAddress['province_code'] ?? null,
                'address_city_code' => $companyAddress['city_code'] ?? null,
                'address_barangay_code' => $companyAddress['barangay_code'] ?? null,
                'address_street' => $companyAddress['street'] ?? null,
            ]);
        }

        $credentials = $request->only('email', 'password', 'password_confirmation', 'token');
        $resetCallback = function (User $user, string $password) use ($normalizedCompanyAddress) {
            $user->forceFill([
                'password' => $password,
                'must_change_password' => false,
                'password_changed_at' => now(),
                'status' => 'active',
                'invitation_accepted_at' => now(),
            ])->save();

            if (is_array($normalizedCompanyAddress)) {
                $user->load(['role', 'companyUser.company']);
                if ($user->role?->name === 'customer' && $user->companyUser?->company) {
                    $user->companyUser->company->update($normalizedCompanyAddress);
                }
            }
        };

        $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();
        $status = Password::INVALID_TOKEN;

        if ($user) {
            foreach (['invitations', 'users'] as $broker) {
                if (! Password::broker($broker)->tokenExists($user, $token)) {
                    continue;
                }
                $status = Password::broker($broker)->reset($credentials, $resetCallback);
                break;
            }
        }

        if ($status === Password::PASSWORD_RESET) {
            $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();
            if ($user) {
                AuditLogger::record($user, 'auth.password_reset', User::class, $user->id, [
                    'email' => $user->email,
                ], $request);
            }

            return response()->json(['message' => 'Password reset successfully. You can now sign in.']);
        }

        throw ValidationException::withMessages([
            'token' => ['Invalid or expired activation link. Ask your administrator to resend the invite.'],
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

    public function updateProfile(Request $request)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
        ]);

        $user = $request->user();

        if (array_key_exists('name', $data)) {
            $user->name = $data['name'];
        }
        if (array_key_exists('phone', $data)) {
            $user->phone = $data['phone'];
        }
        $user->save();

        AuditLogger::record($user, 'auth.profile_updated', User::class, $user->id, [], $request);

        $this->prepareUserPayload($user);

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $user,
        ]);
    }

    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();
        $wasFirstLogin = (bool) $user->must_change_password;

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

        AuditLogger::record($user, 'auth.password_changed', User::class, $user->id, [
            'first_login' => $wasFirstLogin,
        ], $request);

        $this->prepareUserPayload($user);

        return response()->json([
            'message' => 'Password updated successfully.',
            'user' => $user,
        ]);
    }

    private function linkCustomerJobOrdersByCompany(User $user, int $companyId): void
    {
        JobOrder::query()
            ->where('company_id', $companyId)
            ->where(function ($q) use ($user) {
                $q->whereNull('customer_user_id')->orWhere('customer_user_id', '!=', $user->id);
            })
            ->update(['customer_user_id' => $user->id]);
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
            'companyUser.company',
        ]);

        if ($user->companyUser) {
            $user->setAttribute('company_id', $user->companyUser->company_id);
            $user->setAttribute('company_role', $user->companyUser->role);
            $user->setAttribute('company_name', $user->companyUser->company?->company_name);
        }
    }
}
