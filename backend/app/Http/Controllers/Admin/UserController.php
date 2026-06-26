<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Support\DriverAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $perPage = max(1, min(500, (int) $request->input('per_page', 15)));
        return response()->json(User::with('role', 'driver')->paginate($perPage));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'role_id' => 'required|exists:roles,id',
            'name' => 'required|string|max:120',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'phone' => 'nullable|string|max:30',
            'status' => 'nullable|in:active,inactive',
        ]);

        $data['password'] = Hash::make($data['password']);

        $role = Role::query()->findOrFail($data['role_id']);
        $this->assertInternalStaffRole($role->name, isCreate: true);

        $user = User::create($data);
        $user->load('role');

        return response()->json($user->fresh()->load('role', 'driver'), 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'role_id' => 'sometimes|exists:roles,id',
            'name' => 'sometimes|string|max:120',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:8',
            'phone' => 'nullable|string|max:30',
            'status' => 'nullable|in:active,inactive',
        ]);

        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        if (isset($data['role_id'])) {
            $role = Role::query()->findOrFail($data['role_id']);
            $this->assertInternalStaffRole($role->name, isCreate: false);
        }

        $user->update($data);

        if (isset($data['status']) && $data['status'] === 'inactive') {
            app(\App\Services\Auth\SessionService::class)->revokeAllForUser($user->id);
        }

        DriverAccount::sync($user->fresh());

        return response()->json($user->fresh()->load('role', 'driver'));
    }

    public function destroy(User $user)
    {
        $user->delete();

        return response()->json(['message' => 'User deleted']);
    }

    private function assertInternalStaffRole(string $roleName, bool $isCreate): void
    {
        if ($roleName === 'customer') {
            throw ValidationException::withMessages([
                'role_id' => ['Customer accounts must register at /customer/signup.'],
            ]);
        }

        if ($roleName === 'driver') {
            throw ValidationException::withMessages([
                'role_id' => ['Driver accounts must be created via Master Data → Generate Account.'],
            ]);
        }

        $allowed = ['admin', 'dispatcher', 'manager'];
        if (! in_array($roleName, $allowed, true)) {
            throw ValidationException::withMessages([
                'role_id' => ['Invalid role for admin user management.'],
            ]);
        }
    }
}
