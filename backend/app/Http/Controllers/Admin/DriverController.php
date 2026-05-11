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
            'user_id' => 'required|exists:users,id',
            'license_no' => 'required|string|max:60',
            'availability' => 'nullable|in:available,busy,offline',
        ]);

        $driver = Driver::create($data);

        return response()->json($driver->load('user'), 201);
    }

    public function update(Request $request, Driver $driver)
    {
        $data = $request->validate([
            'license_no' => 'sometimes|string|max:60',
            'availability' => 'nullable|in:available,busy,offline',
        ]);

        $driver->update($data);

        return response()->json($driver->load('user'));
    }

    public function destroy(Driver $driver)
    {
        $driver->delete();

        return response()->json(['message' => 'Driver deleted']);
    }
}
