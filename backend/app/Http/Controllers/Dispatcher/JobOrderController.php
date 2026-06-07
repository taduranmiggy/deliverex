<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientQuarryVehiclePreference;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\MaterialSpecification;
use App\Models\MaterialType;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\AuditLogger;
use App\Support\JobOrderScheduleValidator;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class JobOrderController extends Controller
{
    public function index()
    {
        return response()->json(
            JobOrder::with([
                'creator',
                'client',
                'quarry',
                'materialTypeRef',
                'materialSpecification',
                'assignments.driver.user',
                'assignments.vehicle.vehicleType',
            ])->latest()->paginate(20)
        );
    }

    public function show(JobOrder $jobOrder)
    {
        return response()->json($jobOrder->load(
            'creator',
            'client',
            'quarry',
            'materialTypeRef',
            'materialSpecification',
            'assignments.driver.user',
            'assignments.vehicle.vehicleType',
        ));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'client_id'                  => 'required|exists:clients,id',
            // structured name parts (preferred)
            'customer_first_name'        => 'required_without:customer_name|nullable|string|max:80',
            'customer_middle_name'       => 'nullable|string|max:80',
            'customer_last_name'         => 'required_without:customer_name|nullable|string|max:80',
            'customer_suffix'            => 'nullable|string|max:20',
            // legacy fallback
            'customer_name'              => 'required_without:customer_first_name|nullable|string|max:120',
            'customer_email'             => 'nullable|email|max:255',
            'customer_contact'           => 'nullable|string|max:50',
            // structured pickup (preferred)
            'pickup_province'            => 'required_without:pickup_location|nullable|string|max:100',
            'pickup_city'                => 'required_without:pickup_location|nullable|string|max:100',
            'pickup_barangay'            => 'nullable|string|max:100',
            'pickup_street'              => 'required_without:pickup_location|nullable|string|max:255',
            'pickup_landmark'            => 'nullable|string|max:255',
            // legacy fallback
            'pickup_location'            => 'required_without:pickup_province|nullable|string',
            // structured drop-off (preferred)
            'dropoff_province'           => 'required_without:dropoff_location|nullable|string|max:100',
            'dropoff_city'               => 'required_without:dropoff_location|nullable|string|max:100',
            'dropoff_barangay'           => 'nullable|string|max:100',
            'dropoff_street'             => 'required_without:dropoff_location|nullable|string|max:255',
            'dropoff_landmark'           => 'nullable|string|max:255',
            // legacy fallback
            'dropoff_location'           => 'required_without:dropoff_province|nullable|string',
            'quarry_id'                  => 'nullable|exists:quarries,id',
            'material_type_id'           => 'required|exists:material_types,id',
            'material_specification_id'  => 'required|exists:material_specifications,id',
            'material_type'              => 'nullable|string|max:120',
            'specification_size'         => 'nullable|string|max:120',
            'job_requirements'           => 'nullable|string',
            'special_handling_instructions' => 'nullable|string',
            'notes'                      => 'nullable|string',
            'volume_m3'                  => 'nullable|numeric|min:0',
            'load_volume_m3'             => 'required|numeric|min:0',
            'scheduled_start'            => 'nullable|date',
            'scheduled_end'              => 'nullable|date|after_or_equal:scheduled_start',
            'priority'                   => 'nullable|in:low,normal,high,urgent',
        ]);

        JobOrderScheduleValidator::validatePayload($data);

        $client = Client::query()->findOrFail($data['client_id']);
        $materialType = MaterialType::query()->findOrFail($data['material_type_id']);
        $materialSpec = MaterialSpecification::query()->findOrFail($data['material_specification_id']);
        if ((int) $materialSpec->material_type_id !== (int) $materialType->id) {
            return response()->json(['message' => 'Specification does not belong to the selected material type.'], 422);
        }

        if (empty($data['quarry_id'])) {
            $pref = ClientQuarryVehiclePreference::query()
                ->where('client_id', $client->id)
                ->where('is_default', true)
                ->where('status', 'active')
                ->first();
            $data['quarry_id'] = $pref?->quarry_id;
        }

        // Resolve full name from structured parts or fall back to client name
        $data = $this->resolveCustomerName($data, $client->client_name);

        // Resolve combined address strings from structured parts
        $data = $this->resolveAddresses($data);

        $resolvedEmail = $data['customer_email'] ?? $client->email;
        $normalizedEmail = $resolvedEmail ? Str::lower($resolvedEmail) : null;
        $customerAccount = $normalizedEmail
            ? User::query()
                ->where('email', $normalizedEmail)
                ->whereHas('role', fn ($q) => $q->where('name', 'customer'))
                ->first()
            : null;

        $data['created_by']        = $request->user()?->id;
        $data['customer_email']    = $normalizedEmail;
        $data['customer_user_id']  = $customerAccount?->id;
        $data['customer_contact']  = $data['customer_contact'] ?? $client->phone;
        $data['material_type']     = $materialType->name;
        $data['specification_size'] = $materialSpec->name;
        $data['job_requirements']  = $data['job_requirements'] ?? $data['special_handling_instructions'] ?? null;
        $data['volume_m3']         = $data['volume_m3'] ?? $data['load_volume_m3'];
        $data['tracking_code']     = strtoupper(Str::random(10));
        $data['status']            = 'pending';
        $data['priority']          = $data['priority'] ?? 'normal';

        $jobOrder = JobOrder::create($data);

        AuditLogger::record($request->user(), 'job_order.created', JobOrder::class, $jobOrder->id, [
            'tracking_code' => $jobOrder->tracking_code,
        ], $request);

        return response()->json($jobOrder->load('client', 'quarry', 'materialTypeRef', 'materialSpecification'), 201);
    }

    public function update(Request $request, JobOrder $jobOrder)
    {
        $data = $request->validate([
            'client_id'                  => 'sometimes|exists:clients,id',
            // structured name parts
            'customer_first_name'        => 'sometimes|nullable|string|max:80',
            'customer_middle_name'       => 'nullable|string|max:80',
            'customer_last_name'         => 'sometimes|nullable|string|max:80',
            'customer_suffix'            => 'nullable|string|max:20',
            // legacy fallback
            'customer_name'              => 'sometimes|nullable|string|max:120',
            'customer_email'             => 'sometimes|email|max:255',
            'customer_contact'           => 'nullable|string|max:50',
            // structured pickup
            'pickup_province'            => 'sometimes|nullable|string|max:100',
            'pickup_city'                => 'sometimes|nullable|string|max:100',
            'pickup_barangay'            => 'nullable|string|max:100',
            'pickup_street'              => 'sometimes|nullable|string|max:255',
            'pickup_landmark'            => 'nullable|string|max:255',
            // legacy fallback
            'pickup_location'            => 'sometimes|nullable|string',
            // structured drop-off
            'dropoff_province'           => 'sometimes|nullable|string|max:100',
            'dropoff_city'               => 'sometimes|nullable|string|max:100',
            'dropoff_barangay'           => 'nullable|string|max:100',
            'dropoff_street'             => 'sometimes|nullable|string|max:255',
            'dropoff_landmark'           => 'nullable|string|max:255',
            // legacy fallback
            'dropoff_location'           => 'sometimes|nullable|string',
            'quarry_id'                  => 'nullable|exists:quarries,id',
            'material_type_id'           => 'sometimes|exists:material_types,id',
            'material_specification_id'  => 'sometimes|exists:material_specifications,id',
            'material_type'              => 'sometimes|string|max:120',
            'specification_size'         => 'sometimes|string|max:120',
            'job_requirements'           => 'nullable|string',
            'special_handling_instructions' => 'nullable|string',
            'notes'                      => 'nullable|string',
            'volume_m3'                  => 'sometimes|numeric|min:0',
            'load_volume_m3'             => 'sometimes|numeric|min:0',
            'scheduled_start'            => 'nullable|date',
            'scheduled_end'              => 'nullable|date|after_or_equal:scheduled_start',
            'priority'                   => 'nullable|in:low,normal,high,urgent',
            'status'                     => 'nullable|in:pending,assigned,in_progress,arrived,completed,cancelled',
        ]);

        JobOrderScheduleValidator::validatePayload($data);

        if (array_key_exists('material_type_id', $data)) {
            $materialType = MaterialType::query()->findOrFail($data['material_type_id']);
            $data['material_type'] = $materialType->name;
        }

        if (array_key_exists('material_specification_id', $data)) {
            $materialSpec = MaterialSpecification::query()->findOrFail($data['material_specification_id']);
            $data['specification_size'] = $materialSpec->name;
        }

        if (
            array_key_exists('material_type_id', $data) &&
            array_key_exists('material_specification_id', $data)
        ) {
            $materialSpec = MaterialSpecification::query()->findOrFail($data['material_specification_id']);
            if ((int) $materialSpec->material_type_id !== (int) $data['material_type_id']) {
                return response()->json(['message' => 'Specification does not belong to the selected material type.'], 422);
            }
        }

        // Keep structured name fields in sync with legacy customer_name
        $nameFields = ['customer_first_name', 'customer_middle_name', 'customer_last_name', 'customer_suffix', 'customer_name'];
        if (count(array_intersect(array_keys($data), $nameFields)) > 0) {
            $merged = array_merge($jobOrder->only($nameFields), $data);
            $data = array_merge($data, $this->resolveCustomerName($merged, $jobOrder->customer_name ?? ''));
        }

        // Keep structured address fields in sync with legacy combined fields
        $addrFields = ['pickup_province', 'pickup_city', 'pickup_barangay', 'pickup_street', 'pickup_landmark', 'pickup_location',
                        'dropoff_province', 'dropoff_city', 'dropoff_barangay', 'dropoff_street', 'dropoff_landmark', 'dropoff_location'];
        if (count(array_intersect(array_keys($data), $addrFields)) > 0) {
            $merged = array_merge($jobOrder->only($addrFields), $data);
            $data = array_merge($data, $this->resolveAddresses($merged));
        }

        if (array_key_exists('customer_email', $data) && $data['customer_email']) {
            $normalizedEmail = Str::lower($data['customer_email']);
            $customerAccount = User::query()
                ->where('email', $normalizedEmail)
                ->whereHas('role', fn ($q) => $q->where('name', 'customer'))
                ->first();
            $data['customer_email']   = $normalizedEmail;
            $data['customer_user_id'] = $customerAccount?->id;
        }

        if (array_key_exists('load_volume_m3', $data) && ! array_key_exists('volume_m3', $data)) {
            $data['volume_m3'] = $data['load_volume_m3'];
        }
        if (array_key_exists('volume_m3', $data) && ! array_key_exists('load_volume_m3', $data)) {
            $data['load_volume_m3'] = $data['volume_m3'];
        }
        if (array_key_exists('special_handling_instructions', $data) && ! array_key_exists('job_requirements', $data)) {
            $data['job_requirements'] = $data['special_handling_instructions'];
        }

        $jobOrder->update($data);

        AuditLogger::record($request->user(), 'job_order.updated', JobOrder::class, $jobOrder->id, [], $request);

        return response()->json($jobOrder->fresh()->load(
            'creator',
            'client',
            'quarry',
            'materialTypeRef',
            'materialSpecification',
            'assignments.driver.user',
            'assignments.vehicle.vehicleType',
        ));
    }

    public function destroy(Request $request, JobOrder $jobOrder)
    {
        // Only allow deleting jobs that aren't actively in progress
        if (in_array($jobOrder->status, ['in_progress', 'arrived'], true)) {
            return response()->json(['message' => 'Cannot delete a job that is currently in progress.'], 422);
        }

        // Free any driver/vehicle that was assigned to this job order
        foreach ($jobOrder->assignments()->whereIn('status', ['assigned', 'in_progress', 'arrived'])->get() as $assignment) {
            Driver::where('id', $assignment->driver_id)
                ->update(['availability' => 'available', 'current_assignment_id' => null]);
            Vehicle::where('id', $assignment->vehicle_id)
                ->update(['status' => 'available']);
        }

        AuditLogger::record($request->user(), 'job_order.deleted', JobOrder::class, $jobOrder->id, [
            'tracking_code' => $jobOrder->tracking_code,
            'status'        => $jobOrder->status,
        ], $request);

        $jobOrder->delete();

        return response()->json(['message' => 'Job order deleted.']);
    }

    /**
     * Ensure customer_name (legacy) is always derived from structured parts.
     * If only legacy customer_name is provided, the structured parts are left null.
     */
    private function resolveCustomerName(array $data, string $fallbackName = ''): array
    {
        $hasStructured = ! empty($data['customer_first_name']) || ! empty($data['customer_last_name']);

        if ($hasStructured) {
            $parts = array_filter([
                $data['customer_first_name'] ?? null,
                $data['customer_middle_name'] ?? null,
                $data['customer_last_name'] ?? null,
                $data['customer_suffix'] ?? null,
            ]);
            $data['customer_name'] = implode(' ', $parts) ?: $fallbackName;
        } elseif (empty($data['customer_name'])) {
            $data['customer_name'] = $fallbackName;
        }

        return $data;
    }

    /**
     * Build combined pickup_location / dropoff_location strings from structured
     * address parts, and vice versa. Both the structured and legacy fields are
     * always populated so old queries that read pickup_location still work.
     */
    private function resolveAddresses(array $data): array
    {
        // Pickup
        if (! empty($data['pickup_street']) || ! empty($data['pickup_city'])) {
            $parts = array_filter([
                $data['pickup_street']   ?? null,
                $data['pickup_barangay'] ?? null,
                $data['pickup_city']     ?? null,
                $data['pickup_province'] ?? null,
            ]);
            $data['pickup_location'] = implode(', ', $parts);
        }

        // Drop-off
        if (! empty($data['dropoff_street']) || ! empty($data['dropoff_city'])) {
            $parts = array_filter([
                $data['dropoff_street']   ?? null,
                $data['dropoff_barangay'] ?? null,
                $data['dropoff_city']     ?? null,
                $data['dropoff_province'] ?? null,
            ]);
            $data['dropoff_location'] = implode(', ', $parts);
        }

        return $data;
    }
}
