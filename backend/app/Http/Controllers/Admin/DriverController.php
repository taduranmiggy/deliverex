<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Services\Address\StandardizedAddressService;
use App\Services\Driver\DriverAvailabilityService;
use App\Support\AuditChangeTracker;
use App\Support\AuditLogger;
use Illuminate\Http\Request;

class DriverController extends Controller
{
    public function __construct(
        private DriverAvailabilityService $driverAvailability,
        private StandardizedAddressService $addresses,
    ) {
    }
    public function index(Request $request)
    {
        $perPage = max(1, min(100, (int) $request->query('per_page', 6)));

        return response()->json(Driver::with('user')->paginate($perPage));
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
            'address_region_code' => 'required|string|size:10',
            'address_province_code' => 'nullable|string|size:10',
            'address_city_code' => 'required|string|size:10',
            'address_barangay_code' => 'required|string|size:10',
            'address_street' => 'required|string|max:255',
        ]);

        $data = array_merge($data, $this->addresses->normalizeEntityAddress($data));

        $data['full_name'] = trim($data['full_name']);
        if (($data['license_no'] ?? null) !== null) {
            $data['license_no'] = trim((string) $data['license_no']);
            if ($data['license_no'] === '') {
                $data['license_no'] = null;
            }
        }
        $data['status'] = $data['status'] ?? ($data['availability'] ?? 'available');
        $driver = Driver::create($data);
        $this->driverAvailability->sync($driver, 'admin_driver_created', $request->user()?->id);

        AuditLogger::record($request->user(), 'driver.created', Driver::class, $driver->id, [
            'full_name' => $driver->full_name,
        ], $request);

        return response()->json($driver->fresh()->load('user'), 201);
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
            'address_region_code' => 'sometimes|nullable|string|size:10',
            'address_province_code' => 'sometimes|nullable|string|size:10',
            'address_city_code' => 'sometimes|nullable|string|size:10',
            'address_barangay_code' => 'sometimes|nullable|string|size:10',
            'address_street' => 'sometimes|nullable|string|max:255',
        ]);

        $addressFields = ['address_region_code', 'address_province_code', 'address_city_code', 'address_barangay_code', 'address_street'];
        if (count(array_intersect(array_keys($data), $addressFields)) > 0) {
            $data = array_merge($data, $this->addresses->normalizeEntityAddress(array_merge(
                $driver->only($addressFields),
                $data,
            )));
        }

        if (array_key_exists('full_name', $data)) {
            $data['full_name'] = trim($data['full_name']);
        }
        if (array_key_exists('license_no', $data)) {
            $data['license_no'] = trim((string) $data['license_no']) ?: null;
        }
        $trackFields = ['user_id', 'full_name', 'license_no', 'license_expiry', 'availability', 'status'];
        $before = $driver->only($trackFields);

        $driver->update($data);
        if (($driver->status ?? null) !== 'inactive') {
            $this->driverAvailability->sync($driver, 'admin_driver_updated', $request->user()?->id);
        }

        $changes = AuditChangeTracker::diffArrays($before, $driver->fresh()->only($trackFields), $trackFields);
        AuditLogger::recordChanges(
            $request->user(),
            'driver.updated',
            Driver::class,
            $driver->id,
            $changes,
            [],
            $request,
        );

        return response()->json($driver->fresh()->load('user'));
    }

    public function destroy(Request $request, Driver $driver)
    {
        AuditLogger::record($request->user(), 'driver.deactivated', Driver::class, $driver->id, [
            'full_name' => $driver->full_name,
        ], $request);

        $driver->update([
            'status' => 'inactive',
            'availability' => 'offline',
        ]);
        return response()->json(['message' => 'Driver archived']);
    }
}
