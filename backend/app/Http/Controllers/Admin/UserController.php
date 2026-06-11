<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\DriverAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

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

        $user = User::create($data);
        $user->load('role');

        // Always call resolve (it checks role internally); builds a complete
        // driver profile including full_name + status so the driver appears
        // immediately on dispatcher and Best-Fit screens.
        DriverAccount::resolve($user);

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

        $user->update($data);

        // Ensure a driver profile exists (and stays in sync) whenever:
        //  - the user's role is (or becomes) driver, OR
        //  - the user's display name changed (keeps full_name consistent)
        DriverAccount::sync($user->fresh());

        return response()->json($user->fresh()->load('role', 'driver'));
    }

    public function destroy(User $user)
    {
        $user->delete();

        return response()->json(['message' => 'User deleted']);
    }
}
