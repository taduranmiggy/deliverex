<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
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

        if (! Auth::attempt($credentials)) {
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
        $user->forceFill([
            'failed_login_attempts' => 0,
            'locked_until' => null,
        ])->save();

        if (($user->status ?? 'active') !== 'active') {
            return response()->json(['message' => 'Account is not active'], 403);
        }

        $token = $user->createToken('api')->plainTextToken;

        AuditLogger::record($user, 'auth.login_success', User::class, $user->id, [], $request);

        return response()->json([
            'token' => $token,
            'user' => $user->load('role', 'driver'),
        ]);
    }

    /**
     * Register a customer account (public). Other roles are provisioned by admins.
     */
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
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'],
            'status' => 'active',
        ]);

        $token = $user->createToken('api')->plainTextToken;

        AuditLogger::record($user, 'auth.register_customer', User::class, $user->id, [], $request);

        return response()->json([
            'token' => $token,
            'user' => $user->load('role'),
        ], 201);
    }

    public function logout(Request $request)
    {
        $request->user()?->tokens()->delete();

        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user()?->load('role', 'driver'));
    }
}
