<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientQuarryVehiclePreference;
use App\Models\Driver;
use App\Models\DriverVehicleAssignment;
use App\Models\MaterialSpecification;
use App\Models\MaterialType;
use App\Models\Quarry;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleType;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MasterDataController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'material_types' => MaterialType::query()->orderBy('name')->get(),
                'material_specifications' => MaterialSpecification::query()
                    ->with('materialType:id,name')
                    ->orderBy('name')
                    ->get(),
                'clients' => Client::query()->orderBy('client_name')->get(),
                'quarries' => Quarry::query()->orderBy('quarry_name')->get(),
                'vehicle_types' => VehicleType::query()->orderBy('name')->get(),
                'vehicles' => Vehicle::query()
                    ->with('vehicleType:id,name,wheel_type')
                    ->where('status', '!=', 'inactive')
                    ->orderBy('plate_no')
                    ->get(),
                // Include all non-inactive drivers. full_name is now always
                // populated by DriverAccount::resolve(), so the old
                // whereNotNull('full_name') guard is no longer needed.
                'drivers' => Driver::query()
                    ->with('user:id,name,email')
                    ->where(function ($q) {
                        $q->where('status', '!=', 'inactive')
                          ->orWhereNull('status');
                    })
                    ->orderByRaw('COALESCE(full_name, "") ASC')
                    ->get(),
                'driver_vehicle_assignments' => DriverVehicleAssignment::query()
                    ->with(['driver:id,full_name', 'vehicle:id,plate_no', 'vehicle.vehicleType:id,name'])
                    ->latest()
                    ->get(),
                'client_preferences' => ClientQuarryVehiclePreference::query()
                    ->with(['client:id,client_name', 'quarry:id,quarry_name', 'vehicleType:id,name,wheel_type'])
                    ->latest()
                    ->get(),
            ],
        ]);
    }

    public function upsert(Request $request, string $resource, ?int $id = null)
    {
        return match ($resource) {
            'material-types' => $this->saveMaterialType($request, $id),
            'material-specifications' => $this->saveMaterialSpecification($request, $id),
            'clients' => $this->saveClient($request, $id),
            'quarries' => $this->saveQuarry($request, $id),
            'vehicle-types' => $this->saveVehicleType($request, $id),
            'vehicles' => $this->saveVehicle($request, $id),
            'drivers' => $this->saveDriver($request, $id),
            'driver-vehicle-assignments' => $this->saveDriverVehicleAssignment($request, $id),
            'client-preferences' => $this->saveClientPreference($request, $id),
            default => response()->json(['message' => 'Unsupported master data resource.'], 404),
        };
    }

    public function archive(string $resource, int $id)
    {
        $model = $this->resolveArchiveModel($resource, $id);
        if (! $model) {
            return response()->json(['message' => 'Unsupported master data resource.'], 404);
        }

        $model->update(['status' => 'inactive']);
        return response()->json(['message' => 'Record archived successfully.']);
    }

    private function saveMaterialType(Request $request, ?int $id)
    {
        $data = $this->validateEntity($request->all(), [
            'name' => ['required', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);
        $data['name'] = trim($data['name']);
        $data['status'] = $data['status'] ?? 'active';

        $model = $id ? MaterialType::query()->findOrFail($id) : new MaterialType();
        $model->fill($data)->save();
        return response()->json($model->fresh());
    }

    private function saveMaterialSpecification(Request $request, ?int $id)
    {
        $data = $this->validateEntity($request->all(), [
            'material_type_id' => ['required', 'exists:material_types,id'],
            'name' => ['required', 'string', 'max:160'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);
        $data['name'] = trim($data['name']);
        $data['status'] = $data['status'] ?? 'active';

        $model = $id ? MaterialSpecification::query()->findOrFail($id) : new MaterialSpecification();
        $model->fill($data)->save();
        return response()->json($model->fresh()->load('materialType:id,name'));
    }

    private function saveClient(Request $request, ?int $id)
    {
        $data = $this->validateEntity($request->all(), [
            'client_name' => ['required', 'string', 'max:180'],
            'contact_person' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);
        $data['client_name'] = trim($data['client_name']);
        $data['status'] = $data['status'] ?? 'active';

        $model = $id ? Client::query()->findOrFail($id) : new Client();
        $model->fill($data)->save();
        return response()->json($model->fresh());
    }

    private function saveQuarry(Request $request, ?int $id)
    {
        $data = $this->validateEntity($request->all(), [
            'quarry_name' => ['required', 'string', 'max:180'],
            'contact_person' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);
        $data['quarry_name'] = trim($data['quarry_name']);
        $data['status'] = $data['status'] ?? 'active';

        $model = $id ? Quarry::query()->findOrFail($id) : new Quarry();
        $model->fill($data)->save();
        return response()->json($model->fresh());
    }

    private function saveVehicleType(Request $request, ?int $id)
    {
        $data = $this->validateEntity($request->all(), [
            'name' => ['required', 'string', 'max:120'],
            'wheel_type' => ['nullable', 'string', 'max:60'],
            'min_cbm' => ['nullable', 'numeric', 'min:0'],
            'max_cbm' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);
        $data['name'] = trim($data['name']);
        $data['status'] = $data['status'] ?? 'active';

        $model = $id ? VehicleType::query()->findOrFail($id) : new VehicleType();
        $model->fill($data)->save();
        return response()->json($model->fresh());
    }

    private function saveVehicle(Request $request, ?int $id)
    {
        $rulePlate = ['required', 'string', 'max:60', Rule::unique('vehicles', 'plate_no')];
        if ($id) {
            $rulePlate = ['required', 'string', 'max:60', Rule::unique('vehicles', 'plate_no')->ignore($id)];
        }

        $data = $this->validateEntity($request->all(), [
            'plate_no' => $rulePlate,
            'vehicle_type_id' => ['nullable', 'exists:vehicle_types,id'],
            'type' => ['nullable', 'string', 'max:80'],
            'capacity' => ['nullable', 'string', 'max:80'],
            'length_cm' => ['nullable', 'numeric', 'min:0'],
            'width_cm' => ['nullable', 'numeric', 'min:0'],
            'height_cm' => ['nullable', 'numeric', 'min:0'],
            'raw_cbm_value' => ['nullable', 'numeric', 'min:0'],
            'cbm_capacity' => ['nullable', 'numeric', 'min:0'],
            'rounded_cbm_capacity' => ['nullable', 'integer', 'min:0'],
            'max_weight_kg' => ['nullable', 'numeric', 'min:0'],
            'max_volume_m3' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['available', 'assigned', 'in_use', 'maintenance', 'inactive', 'unavailable'])],
        ]);

        $data['plate_no'] = strtoupper(trim($data['plate_no']));
        $data['status'] = $data['status'] ?? 'available';
        $data = $this->normalizeVehicleCapacityFields($data);

        $model = $id ? Vehicle::query()->findOrFail($id) : new Vehicle();
        $model->fill($data)->save();
        return response()->json($model->fresh()->load('vehicleType:id,name,wheel_type'));
    }

    private function saveDriver(Request $request, ?int $id)
    {
        $data = $this->validateEntity($request->all(), [
            'user_id' => ['nullable', 'exists:users,id'],
            'full_name' => ['required', 'string', 'max:160'],
            'license_no' => ['nullable', 'string', 'max:60'],
            'license_expiry' => ['nullable', 'date'],
            'availability' => ['nullable', Rule::in(['available', 'busy', 'offline'])],
            'status' => ['nullable', Rule::in(['available', 'assigned', 'in_use', 'inactive'])],
        ]);

        $data['full_name'] = trim($data['full_name']);
        $data['license_no'] = isset($data['license_no']) ? trim((string) $data['license_no']) : null;
        $data['license_no'] = $data['license_no'] ?: null;
        $data['status'] = $data['status'] ?? 'available';
        $data['availability'] = $data['availability'] ?? ($data['status'] === 'inactive' ? 'offline' : 'available');

        $model = $id ? Driver::query()->findOrFail($id) : new Driver();
        $model->fill($data)->save();
        return response()->json($model->fresh()->load('user:id,name,email'));
    }

    private function saveDriverVehicleAssignment(Request $request, ?int $id)
    {
        $data = $this->validateEntity($request->all(), [
            'driver_id' => ['required', 'exists:drivers,id'],
            'vehicle_id' => ['required', 'exists:vehicles,id'],
            'is_primary' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);
        $data['status'] = $data['status'] ?? 'active';
        $data['is_primary'] = (bool) ($data['is_primary'] ?? false);

        if ($data['is_primary']) {
            DriverVehicleAssignment::query()
                ->where('driver_id', $data['driver_id'])
                ->where('id', '!=', $id ?? 0)
                ->update(['is_primary' => false]);
        }

        $model = $id ? DriverVehicleAssignment::query()->findOrFail($id) : new DriverVehicleAssignment();
        $model->fill($data)->save();
        return response()->json($model->fresh()->load(['driver:id,full_name', 'vehicle:id,plate_no']));
    }

    private function saveClientPreference(Request $request, ?int $id)
    {
        $data = $this->validateEntity($request->all(), [
            'client_id' => ['required', 'exists:clients,id'],
            'quarry_id' => ['required', 'exists:quarries,id'],
            'vehicle_type_id' => ['nullable', 'exists:vehicle_types,id'],
            'is_default' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $data['is_default'] = (bool) ($data['is_default'] ?? true);
        $data['status'] = $data['status'] ?? 'active';

        if ($data['is_default']) {
            ClientQuarryVehiclePreference::query()
                ->where('client_id', $data['client_id'])
                ->where('id', '!=', $id ?? 0)
                ->update(['is_default' => false]);
        }

        $model = $id ? ClientQuarryVehiclePreference::query()->findOrFail($id) : new ClientQuarryVehiclePreference();
        $model->fill($data)->save();
        return response()->json($model->fresh()->load(['client:id,client_name', 'quarry:id,quarry_name', 'vehicleType:id,name,wheel_type']));
    }

    private function resolveArchiveModel(string $resource, int $id): ?object
    {
        return match ($resource) {
            'material-types' => MaterialType::query()->findOrFail($id),
            'material-specifications' => MaterialSpecification::query()->findOrFail($id),
            'clients' => Client::query()->findOrFail($id),
            'quarries' => Quarry::query()->findOrFail($id),
            'vehicle-types' => VehicleType::query()->findOrFail($id),
            'vehicles' => Vehicle::query()->findOrFail($id),
            'drivers' => Driver::query()->findOrFail($id),
            'driver-vehicle-assignments' => DriverVehicleAssignment::query()->findOrFail($id),
            'client-preferences' => ClientQuarryVehiclePreference::query()->findOrFail($id),
            default => null,
        };
    }

    // ─── Driver Account Generation ────────────────────────────────────────────────

    /**
     * POST /admin/master-data/drivers/{driver}/generate-account
     *
     * Creates (or reuses) a login account for a Master Data driver record and links
     * drivers.user_id to the account.  Idempotent — calling it multiple times is safe.
     */
    public function generateDriverAccount(Driver $driver): \Illuminate\Http\JsonResponse
    {
        // Already linked — return current state without touching anything
        if ($driver->user_id && $driver->user) {
            return response()->json([
                'message'  => 'Driver already has a linked account.',
                'driver'   => $driver->load('user:id,name,email,status'),
                'created'  => false,
                'reused'   => true,
            ]);
        }

        $driverRole = Role::where('name', 'driver')->first();
        if (!$driverRole) {
            return response()->json(['message' => 'Driver role not found in roles table.'], 500);
        }

        $email    = $this->makeDriverEmail($driver->full_name);
        $password = 'Password123!';

        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name'     => $driver->full_name,
                'password' => Hash::make($password),
                'role_id'  => $driverRole->id,
                'status'   => 'active',
            ]
        );

        $wasCreated = $user->wasRecentlyCreated;

        // Link the driver record to this account
        $driver->update(['user_id' => $user->id]);

        // Also patch missing status/availability fields on the driver row
        $patch = [];
        if (empty($driver->status))       $patch['status']       = 'available';
        if (empty($driver->availability)) $patch['availability'] = 'available';
        if (!empty($patch))               $driver->update($patch);

        return response()->json([
            'message'          => $wasCreated
                ? "Account created and linked: {$email}"
                : "Existing account found and linked: {$email}",
            'driver'           => $driver->fresh()->load('user:id,name,email,status'),
            'email'            => $email,
            'default_password' => $wasCreated ? $password : null,
            'created'          => $wasCreated,
            'reused'           => !$wasCreated,
        ]);
    }

    /**
     * POST /admin/master-data/drivers/generate-all-accounts
     *
     * Bulk-generate login accounts for every driver that has no user_id.
     * Safe to re-run — already-linked drivers are skipped.
     */
    public function generateAllDriverAccounts(): \Illuminate\Http\JsonResponse
    {
        $driverRole = Role::where('name', 'driver')->first();
        if (!$driverRole) {
            return response()->json(['message' => 'Driver role not found in roles table.'], 500);
        }

        $unlinked = Driver::whereNull('user_id')
            ->whereNotNull('full_name')
            ->where(fn ($q) => $q->where('status', '!=', 'inactive')->orWhereNull('status'))
            ->get();

        $results = [
            'processed'  => 0,
            'created'    => 0,
            'reused'     => 0,
            'skipped'    => 0,
            'accounts'   => [],
        ];

        foreach ($unlinked as $driver) {
            $email = $this->makeDriverEmail($driver->full_name);

            $user = User::updateOrCreate(
                ['email' => $email],
                [
                    'name'     => $driver->full_name,
                    'password' => Hash::make('Password123!'),
                    'role_id'  => $driverRole->id,
                    'status'   => 'active',
                ]
            );

            $driver->update([
                'user_id'      => $user->id,
                'status'       => $driver->status       ?? 'available',
                'availability' => $driver->availability ?? 'available',
            ]);

            $results['processed']++;
            if ($user->wasRecentlyCreated) {
                $results['created']++;
            } else {
                $results['reused']++;
            }

            $results['accounts'][] = [
                'driver_id'   => $driver->id,
                'driver_name' => $driver->full_name,
                'email'       => $email,
                'created'     => $user->wasRecentlyCreated,
            ];
        }

        return response()->json([
            'message' => "Processed {$results['processed']} drivers: {$results['created']} accounts created, {$results['reused']} existing accounts reused.",
            ...$results,
        ]);
    }

    /**
     * Derive a unique driver login email from a display name.
     * Example: "Juan Dela Cruz" → "juan.dela.cruz@deliverex.driver"
     */
    private function makeDriverEmail(string $fullName): string
    {
        $slug  = Str::slug(trim($fullName), '.');
        $email = "{$slug}@deliverex.driver";

        // Append an incrementing suffix if the email is already taken
        $base = $slug;
        $i    = 2;
        while (User::where('email', $email)->exists()) {
            $email = "{$base}.{$i}@deliverex.driver";
            $i++;
        }

        return $email;
    }

    private function validateEntity(array $payload, array $rules): array
    {
        $validator = Validator::make($payload, $rules);
        $validator->validate();
        return Arr::only($validator->validated(), array_keys($rules));
    }

    private function normalizeVehicleCapacityFields(array $data): array
    {
        if (
            isset($data['length_cm'], $data['width_cm'], $data['height_cm']) &&
            (! isset($data['cbm_capacity']) || $data['cbm_capacity'] === null)
        ) {
            $cbm = ((float) $data['length_cm'] * (float) $data['width_cm'] * (float) $data['height_cm']) / 1_000_000;
            $data['raw_cbm_value'] = round($cbm * 1_000_000, 3);
            $data['cbm_capacity'] = round($cbm, 3);
            $data['rounded_cbm_capacity'] = (int) round($cbm);
        }

        if (isset($data['cbm_capacity']) && (! isset($data['max_volume_m3']) || $data['max_volume_m3'] === null)) {
            $data['max_volume_m3'] = $data['cbm_capacity'];
        }
        if (isset($data['rounded_cbm_capacity']) && empty($data['capacity'])) {
            $data['capacity'] = $data['rounded_cbm_capacity'].' m3';
        }

        return $data;
    }
}
