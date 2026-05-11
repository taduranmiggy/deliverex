<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use Illuminate\Http\Request;

class VehicleController extends Controller
{
    public function index()
    {
        return response()->json(Vehicle::paginate(20));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'plate_no' => 'required|string|max:60|unique:vehicles,plate_no',
            'type' => 'required|string|max:80',
            'capacity' => 'nullable|string|max:80',
            'max_weight_kg' => 'nullable|numeric|min:0',
            'max_volume_m3' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:available,assigned,maintenance',
        ]);

        $vehicle = Vehicle::create($data);

        return response()->json($vehicle, 201);
    }

    public function update(Request $request, Vehicle $vehicle)
    {
        $data = $request->validate([
            'plate_no' => 'sometimes|string|max:60|unique:vehicles,plate_no,' . $vehicle->id,
            'type' => 'sometimes|string|max:80',
            'capacity' => 'nullable|string|max:80',
            'max_weight_kg' => 'nullable|numeric|min:0',
            'max_volume_m3' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:available,assigned,maintenance',
        ]);

        $vehicle->update($data);

        return response()->json($vehicle);
    }

    public function destroy(Vehicle $vehicle)
    {
        $vehicle->delete();

        return response()->json(['message' => 'Vehicle deleted']);
    }
}
