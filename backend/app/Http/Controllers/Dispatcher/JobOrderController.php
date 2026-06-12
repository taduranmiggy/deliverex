<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientQuarryVehiclePreference;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\MaterialSpecification;
use App\Models\MaterialType;
use App\Models\Quarry;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\Delivery\DropoffGeocoder;
use App\Services\MasterData\MaterialMasterDataService;
use App\Support\AuditLogger;
use App\Support\JobOrderScheduleValidator;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class JobOrderController extends Controller
{
    public function __construct(private MaterialMasterDataService $materialMasterData)
    {
    }

    public function index()
    {
        return response()->json(
            JobOrder::with([
                'creator',
                'client',
                'quarry',
                'preferredVehicleType',
                'materialTypeRef',
                'materialSpecification',
                'assignments.driver.user',
                'assignments.vehicle.vehicleType',
                'assignments.deliveryDocuments' => fn ($q) => $q->where('type', 'departure'),
            ])->latest()->paginate(20)
        );
    }

    public function show(JobOrder $jobOrder)
    {
        return response()->json($jobOrder->load([
            'creator',
            'client',
            'quarry',
            'preferredVehicleType',
            'materialTypeRef',
            'materialSpecification',
            'assignments.driver.user',
            'assignments.vehicle.vehicleType',
            'assignments.deliveryDocuments' => fn ($q) => $q->where('type', 'departure'),
        ]));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'client_id'                  => 'nullable|exists:clients,id',
            'custom_client_name'         => 'nullable|string|max:200',
            // legacy fields kept for backward compatibility
            'client_mode'                => 'nullable|in:existing,new',
            'customer_first_name'        => 'nullable|string|max:80',
            'customer_middle_name'       => 'nullable|string|max:80',
            'customer_last_name'         => 'nullable|string|max:80',
            'customer_suffix'            => 'nullable|string|max:20',
            'customer_name'              => 'nullable|string|max:120',
            'contact_person'             => 'nullable|string|max:120',
            'customer_email'             => 'nullable|email|max:255',
            'customer_contact'           => 'nullable|string|max:50',
            'pickup_province'            => 'nullable|string|max:100',
            'pickup_city'                => 'nullable|string|max:100',
            'pickup_barangay'            => 'nullable|string|max:100',
            'pickup_street'              => 'nullable|string|max:255',
            'pickup_landmark'            => 'nullable|string|max:255',
            'pickup_location'            => 'nullable|string',
            'dropoff_province'           => 'required_without:dropoff_location|nullable|string|max:100',
            'dropoff_city'               => 'required_without:dropoff_location|nullable|string|max:100',
            'dropoff_barangay'           => 'nullable|string|max:100',
            'dropoff_street'             => 'required_without:dropoff_location|nullable|string|max:255',
            'dropoff_landmark'           => 'nullable|string|max:255',
            'dropoff_location'           => 'required_without:dropoff_province|nullable|string',
            'quarry_id'                  => 'nullable|exists:quarries,id',
            'preferred_vehicle_type_id'  => 'nullable|exists:vehicle_types,id',
            'material_type_id'           => 'nullable|exists:material_types,id',
            'custom_material_type_name'  => 'nullable|string|max:120',
            'material_specification_id'  => 'nullable|exists:material_specifications,id',
            'custom_specification_name'  => 'nullable|string|max:160',
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
            'save_as_client'             => 'nullable|boolean',
        ]);

        $data = $this->normalizeClientInput($data);

        if (empty($data['client_id']) && empty($data['custom_client_name'])) {
            return response()->json(['message' => 'Select an existing client or enter a custom client name.'], 422);
        }

        if (! empty($data['client_id']) && ! empty($data['custom_client_name'])) {
            return response()->json(['message' => 'Provide either client_id or custom_client_name, not both.'], 422);
        }

        JobOrderScheduleValidator::validatePayload($data);

        $data = $this->materialMasterData->resolveJobOrderMaterials($data);

        // Resolve / create the client.
        $client = null;
        if (! empty($data['client_id'])) {
            $client = Client::query()->findOrFail($data['client_id']);
            $data['custom_client_name'] = null;

            if (empty($data['quarry_id'])) {
                $pref = ClientQuarryVehiclePreference::query()
                    ->where('client_id', $client->id)
                    ->where('is_default', true)
                    ->where('status', 'active')
                    ->first();
                $data['quarry_id'] = $pref?->quarry_id;
                if (empty($data['preferred_vehicle_type_id'])) {
                    $data['preferred_vehicle_type_id'] = $pref?->vehicle_type_id;
                }
            }
        } else {
            $customName = trim((string) $data['custom_client_name']);
            $data['custom_client_name'] = $customName;

            if (! empty($data['save_as_client'])) {
                $client = $this->saveNewClientToMasterData([
                    'customer_name'    => $customName,
                    'custom_client_name' => $customName,
                    'contact_person'   => $data['contact_person'] ?? null,
                    'customer_email'   => $data['customer_email'] ?? null,
                    'customer_contact' => $data['customer_contact'] ?? null,
                    'pickup_location'  => $data['pickup_location'] ?? null,
                ]);
                $data['client_id'] = $client->id;
                $data['custom_client_name'] = null;
                $this->maybeCreatePreference($client, $data);
            }
        }

        // A job needs a source: either a quarry/supplier (possibly auto-filled from the
        // client preference above) OR explicit pickup details.
        if (empty($data['quarry_id']) && empty($data['pickup_location']) && empty($data['pickup_province'])) {
            return response()->json(['message' => 'Provide a quarry/supplier or pickup source details.'], 422);
        }

        // Resolve full name from client, custom name, or legacy parts
        $data = $this->resolveCustomerName($data, $client?->client_name ?? $data['custom_client_name'] ?? '');

        // Resolve combined address strings from structured parts
        $data = $this->resolveAddresses($data);

        // For quarry-sourced jobs with no explicit pickup address, use the quarry
        // name as the legacy pickup source so routes/reports still read sensibly.
        if (empty($data['pickup_location']) && ! empty($data['quarry_id'])) {
            $quarry = Quarry::query()->find($data['quarry_id']);
            $data['pickup_location'] = $quarry?->quarry_name;
        }

        $resolvedEmail = $data['customer_email'] ?? $client?->email;
        $normalizedEmail = $resolvedEmail ? Str::lower($resolvedEmail) : null;
        $customerAccount = $normalizedEmail
            ? User::query()
                ->where('email', $normalizedEmail)
                ->whereHas('role', fn ($q) => $q->where('name', 'customer'))
                ->first()
            : null;

        $data['created_by']         = $request->user()?->id;
        $data['customer_email']     = $normalizedEmail;
        $data['customer_user_id']   = $customerAccount?->id;
        $data['customer_contact']   = $data['customer_contact'] ?? $client?->phone;
        $data['job_requirements']   = $data['job_requirements'] ?? $data['special_handling_instructions'] ?? null;
        $data['volume_m3']          = $data['volume_m3'] ?? $data['load_volume_m3'];
        $data['tracking_code']      = strtoupper(Str::random(10));
        $data['status']             = 'pending';
        $data['priority']           = $data['priority'] ?? 'normal';

        // Strip non-column helper fields before persisting.
        unset($data['client_mode'], $data['save_as_client'], $data['contact_person']);

        $jobOrder = JobOrder::create($data);
        $this->geocodeDropoff($jobOrder);

        AuditLogger::record($request->user(), 'job_order.created', JobOrder::class, $jobOrder->id, [
            'tracking_code' => $jobOrder->tracking_code,
            'client_id'     => $jobOrder->client_id,
            'custom_client' => (bool) $request->input('custom_client_name'),
        ], $request);

        return response()->json($jobOrder->fresh()->load('client', 'quarry', 'preferredVehicleType', 'materialTypeRef', 'materialSpecification'), 201);
    }

    /**
     * Create or update a client record in Master Data from new-client job order
     * details, avoiding duplicates by matching on the (case-insensitive) name.
     */
    private function saveNewClientToMasterData(array $data): Client
    {
        $clientName = trim($data['customer_name'] ?? $data['custom_client_name'] ?? '') ?: trim(implode(' ', array_filter([
            $data['customer_first_name'] ?? null,
            $data['customer_last_name'] ?? null,
        ])));

        $existing = Client::query()->whereRaw('LOWER(client_name) = ?', [Str::lower($clientName)])->first();

        return Client::updateOrCreate(
            ['id' => $existing?->id],
            [
                'client_name'    => $clientName,
                'contact_person' => $data['contact_person'] ?? null,
                'email'          => isset($data['customer_email']) ? Str::lower($data['customer_email']) : null,
                'phone'          => $data['customer_contact'] ?? null,
                'address'        => $data['pickup_location'] ?? null,
                'status'         => 'active',
            ]
        );
    }

    /**
     * Optionally store a default quarry/vehicle preference for a freshly saved client.
     */
    private function maybeCreatePreference(Client $client, array $data): void
    {
        if (empty($data['quarry_id'])) {
            return;
        }

        ClientQuarryVehiclePreference::updateOrCreate(
            [
                'client_id'       => $client->id,
                'quarry_id'       => $data['quarry_id'],
                'vehicle_type_id' => $data['preferred_vehicle_type_id'] ?? null,
            ],
            [
                'is_default' => true,
                'status'     => 'active',
            ]
        );
    }

    public function update(Request $request, JobOrder $jobOrder)
    {
        $data = $request->validate([
            'client_id'                  => 'sometimes|nullable|exists:clients,id',
            'custom_client_name'         => 'sometimes|nullable|string|max:200',
            // structured name parts (legacy)
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
            'preferred_vehicle_type_id'  => 'nullable|exists:vehicle_types,id',
            'material_type_id'           => 'sometimes|nullable|exists:material_types,id',
            'custom_material_type_name'  => 'sometimes|nullable|string|max:120',
            'material_specification_id'  => 'sometimes|nullable|exists:material_specifications,id',
            'custom_specification_name'  => 'sometimes|nullable|string|max:160',
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

        $materialFields = ['material_type_id', 'custom_material_type_name', 'material_specification_id', 'custom_specification_name'];
        if (count(array_intersect(array_keys($data), $materialFields)) > 0) {
            $merged = array_merge($jobOrder->only(['material_type_id', 'material_specification_id']), $data);
            $data = array_merge($data, $this->materialMasterData->resolveJobOrderMaterials($merged));
        }

        if (array_key_exists('client_id', $data) || array_key_exists('custom_client_name', $data)) {
            $data = $this->normalizeClientInput($data);
            if (! empty($data['client_id'])) {
                $data['custom_client_name'] = null;
            }
        }

        // Keep structured name fields in sync with legacy customer_name
        $nameFields = ['customer_first_name', 'customer_middle_name', 'customer_last_name', 'customer_suffix', 'customer_name', 'custom_client_name'];
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

        $dropoffChanged = count(array_intersect(array_keys($data), $addrFields)) > 0;

        $jobOrder->update($data);

        if ($dropoffChanged) {
            $jobOrder->update(['dropoff_latitude' => null, 'dropoff_longitude' => null]);
            $this->geocodeDropoff($jobOrder->fresh());
        }

        AuditLogger::record($request->user(), 'job_order.updated', JobOrder::class, $jobOrder->id, [], $request);

        return response()->json($jobOrder->fresh()->load([
            'creator',
            'client',
            'quarry',
            'preferredVehicleType',
            'materialTypeRef',
            'materialSpecification',
            'assignments.driver.user',
            'assignments.vehicle.vehicleType',
            'assignments.deliveryDocuments' => fn ($q) => $q->where('type', 'departure'),
        ]));
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
     * Map legacy client_mode payloads to client_id / custom_client_name.
     */
    private function normalizeClientInput(array $data): array
    {
        if (! empty($data['custom_client_name'])) {
            $data['custom_client_name'] = trim((string) $data['custom_client_name']);
        }

        if (($data['client_mode'] ?? null) === 'new' && empty($data['client_id'])) {
            if (empty($data['custom_client_name'])) {
                $legacyName = trim($data['customer_name'] ?? '') ?: trim(implode(' ', array_filter([
                    $data['customer_first_name'] ?? null,
                    $data['customer_middle_name'] ?? null,
                    $data['customer_last_name'] ?? null,
                    $data['customer_suffix'] ?? null,
                ])));
                if ($legacyName !== '') {
                    $data['custom_client_name'] = $legacyName;
                }
            }
        }

        if (($data['client_mode'] ?? null) === 'existing' && ! empty($data['client_id'])) {
            $data['custom_client_name'] = null;
        }

        return $data;
    }

    /**
     * Ensure customer_name (legacy) is always derived from client/custom name or structured parts.
     */
    private function resolveCustomerName(array $data, string $fallbackName = ''): array
    {
        if (! empty($data['custom_client_name'])) {
            $data['customer_name'] = trim((string) $data['custom_client_name']);

            return $data;
        }

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

    private function geocodeDropoff(JobOrder $jobOrder): void
    {
        if ($jobOrder->dropoff_latitude !== null && $jobOrder->dropoff_longitude !== null) {
            return;
        }

        $address = $jobOrder->display_dropoff;
        if ($address === '') {
            return;
        }

        $coords = app(DropoffGeocoder::class)->geocode($address);
        if ($coords) {
            $jobOrder->update([
                'dropoff_latitude'  => $coords['lat'],
                'dropoff_longitude' => $coords['lng'],
            ]);
        }
    }
}
