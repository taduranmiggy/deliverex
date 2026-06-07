<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Models\VehicleType;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class VehicleController extends Controller
{
    public function index()
    {
        return response()->json(Vehicle::with('vehicleType')->paginate(20));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'plate_no' => 'required|string|max:60|unique:vehicles,plate_no',
            'vehicle_type_id' => 'nullable|exists:vehicle_types,id',
            'type' => 'nullable|string|max:80',
            'capacity' => 'nullable|string|max:80',
            'length_cm' => 'nullable|numeric|min:0',
            'width_cm' => 'nullable|numeric|min:0',
            'height_cm' => 'nullable|numeric|min:0',
            'raw_cbm_value' => 'nullable|numeric|min:0',
            'cbm_capacity' => 'nullable|numeric|min:0',
            'rounded_cbm_capacity' => 'nullable|integer|min:0',
            'max_weight_kg' => 'nullable|numeric|min:0',
            'max_volume_m3' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:available,assigned,in_use,maintenance,inactive,unavailable',
        ]);

        $this->normalizeVehiclePayload($data);
        $vehicle = Vehicle::create($data);

        return response()->json($vehicle->load('vehicleType'), 201);
    }

    public function update(Request $request, Vehicle $vehicle)
    {
        $data = $request->validate([
            'plate_no' => 'sometimes|string|max:60|unique:vehicles,plate_no,' . $vehicle->id,
            'vehicle_type_id' => 'nullable|exists:vehicle_types,id',
            'type' => 'nullable|string|max:80',
            'capacity' => 'nullable|string|max:80',
            'length_cm' => 'nullable|numeric|min:0',
            'width_cm' => 'nullable|numeric|min:0',
            'height_cm' => 'nullable|numeric|min:0',
            'raw_cbm_value' => 'nullable|numeric|min:0',
            'cbm_capacity' => 'nullable|numeric|min:0',
            'rounded_cbm_capacity' => 'nullable|integer|min:0',
            'max_weight_kg' => 'nullable|numeric|min:0',
            'max_volume_m3' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:available,assigned,in_use,maintenance,inactive,unavailable',
        ]);

        $this->normalizeVehiclePayload($data);
        $vehicle->update($data);

        return response()->json($vehicle->fresh()->load('vehicleType'));
    }

    public function destroy(Vehicle $vehicle)
    {
        $vehicle->update(['status' => 'inactive']);
        return response()->json(['message' => 'Vehicle archived']);
    }

    private function normalizeVehiclePayload(array &$data): void
    {
        if (isset($data['plate_no'])) {
            $data['plate_no'] = Str::upper(trim($data['plate_no']));
        }

        if (! empty($data['vehicle_type_id'])) {
            $type = VehicleType::find($data['vehicle_type_id']);
            if ($type && empty($data['type'])) {
                $data['type'] = $type->name;
            }
        }

        if (
            isset($data['length_cm'], $data['width_cm'], $data['height_cm']) &&
            ! isset($data['cbm_capacity'])
        ) {
            $calculated = ((float) $data['length_cm'] * (float) $data['width_cm'] * (float) $data['height_cm']) / 1_000_000;
            $data['raw_cbm_value'] = round($calculated * 1_000_000, 3);
            $data['cbm_capacity'] = round($calculated, 3);
            $data['rounded_cbm_capacity'] = (int) round($calculated);
            if (! isset($data['max_volume_m3'])) {
                $data['max_volume_m3'] = $data['cbm_capacity'];
            }
            if (! isset($data['capacity'])) {
                $data['capacity'] = $data['rounded_cbm_capacity'].' m3';
            }
        }
    }
}
