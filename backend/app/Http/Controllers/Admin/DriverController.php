<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use Illuminate\Http\Request;

class DriverController extends Controller
{
    public function index()
    {
        return response()->json(Driver::with('user')->paginate(20));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'nullable|exists:users,id',
            'full_name' => 'required|string|max:160',
            'license_no' => 'nullable|string|max:60',
            'license_expiry' => 'nullable|date',
            'availability' => 'nullable|in:available,busy,offline',
            'status' => 'nullable|in:available,assigned,in_use,inactive',
        ]);

        $data['full_name'] = trim($data['full_name']);
        if (($data['license_no'] ?? null) !== null) {
            $data['license_no'] = trim((string) $data['license_no']);
            if ($data['license_no'] === '') {
                $data['license_no'] = null;
            }
        }
        $data['status'] = $data['status'] ?? ($data['availability'] ?? 'available');
        $driver = Driver::create($data);

        return response()->json($driver->load('user'), 201);
    }

    public function update(Request $request, Driver $driver)
    {
        $data = $request->validate([
            'user_id' => 'nullable|exists:users,id',
            'full_name' => 'sometimes|string|max:160',
            'license_no' => 'sometimes|string|max:60',
            'license_expiry' => 'nullable|date',
            'availability' => 'nullable|in:available,busy,offline',
            'status' => 'nullable|in:available,assigned,in_use,inactive',
        ]);

        if (array_key_exists('full_name', $data)) {
            $data['full_name'] = trim($data['full_name']);
        }
        if (array_key_exists('license_no', $data)) {
            $data['license_no'] = trim((string) $data['license_no']) ?: null;
        }
        $driver->update($data);

        return response()->json($driver->load('user'));
    }

    public function destroy(Driver $driver)
    {
        $driver->update([
            'status' => 'inactive',
            'availability' => 'offline',
        ]);
        return response()->json(['message' => 'Driver archived']);
    }
}
