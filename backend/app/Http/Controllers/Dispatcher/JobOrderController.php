<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Client;
use App\Models\CompanyQuarryVehiclePreference;
use App\Models\ClientQuarryVehiclePreference;
use App\Services\Company\CompanyService;
use App\Services\Driver\DriverAvailabilityService;
use App\Services\Fleet\AssignmentResourceSyncService;
use App\Models\JobOrder;
use App\Models\MaterialSpecification;
use App\Models\MaterialType;
use App\Models\User;
use App\Services\Address\StandardizedAddressService;
use App\Services\Geocoding\ConfirmedLocationService;
use App\Services\MasterData\MaterialMasterDataService;
use App\Support\AuditChangeTracker;
use App\Support\AuditLogger;
use App\Support\DeliveryStatus;
use App\Support\JobOrderAddressFormatter;
use App\Support\JobOrderAddressValidator;
use App\Support\JobOrderScheduleValidator;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class JobOrderController extends Controller
{
    public function __construct(
        private MaterialMasterDataService $materialMasterData,
        private CompanyService $companyService,
        private DriverAvailabilityService $driverAvailability,
        private AssignmentResourceSyncService $resourceSync,
        private StandardizedAddressService $addresses,
        private ConfirmedLocationService $confirmedLocations,
    ) {
    }

    public function index(Request $request)
    {
        $perPage = max(1, min(100, (int) $request->query('per_page', 6)));

        return response()->json(
            JobOrder::with([
                'creator',
                'company',
                'client',
                'quarry',
                'preferredVehicleType',
                'materialTypeRef',
                'materialSpecification',
                'assignments.driver.user',
                'assignments.vehicle.vehicleType',
                'assignments.deliveryDocuments' => fn ($q) => $q->where('type', 'departure'),
            ])->where('is_archived', false)->latest()->paginate($perPage)
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
            'company_id'                 => 'required_without:client_id|nullable|exists:companies,id',
            'client_id'                  => 'required_without:company_id|nullable|exists:companies,id',
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
            'pickup_region_code'         => 'required|string|size:10',
            'pickup_province_code'       => 'nullable|string|size:10',
            'pickup_city_code'           => 'required|string|size:10',
            'pickup_barangay_code'       => 'required|string|size:10',
            'pickup_province'            => 'nullable|string|max:100',
            'pickup_city'                => 'nullable|string|max:100',
            'pickup_barangay'            => 'nullable|string|max:100',
            'pickup_street'              => 'required|string|max:255',
            'pickup_landmark'            => 'nullable|string|max:255',
            'pickup_location'            => 'nullable|string',
            'pickup_coordinate_confirmation_token' => 'nullable|string',
            'dropoff_region_code'        => 'required|string|size:10',
            'dropoff_province_code'      => 'nullable|string|size:10',
            'dropoff_city_code'          => 'required|string|size:10',
            'dropoff_barangay_code'      => 'required|string|size:10',
            'dropoff_province'           => 'nullable|string|max:100',
            'dropoff_city'               => 'nullable|string|max:100',
            'dropoff_barangay'           => 'nullable|string|max:100',
            'dropoff_street'             => 'required|string|max:255',
            'dropoff_landmark'           => 'nullable|string|max:255',
            'dropoff_location'           => 'nullable|string',
            'dropoff_coordinate_confirmation_token' => 'nullable|string',
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
        $data['company_id'] = $data['company_id'] ?? $data['client_id'] ?? null;

        if (empty($data['company_id'])) {
            return response()->json(['message' => 'Company is required.'], 422);
        }

        if (! empty($data['custom_client_name'])) {
            return response()->json(['message' => 'Custom client names are no longer supported. Select an active company.'], 422);
        }

        JobOrderScheduleValidator::validatePayload($data);

        $data = $this->materialMasterData->resolveJobOrderMaterials($data);

        $company = Company::query()
            ->where('id', $data['company_id'])
            ->where('status', Company::STATUS_ACTIVE)
            ->firstOrFail();

        $data['company_id'] = $company->id;

        if (empty($data['quarry_id'])) {
            $pref = CompanyQuarryVehiclePreference::query()
                ->where('company_id', $company->id)
                ->where('is_default', true)
                ->where('status', 'active')
                ->first();
            $data['quarry_id'] = $pref?->quarry_id;
            if (empty($data['preferred_vehicle_type_id'])) {
                $data['preferred_vehicle_type_id'] = $pref?->vehicle_type_id;
            }
        }

        $data['customer_email'] = Str::lower(trim($company->company_email));
        $data['customer_contact'] = $company->contact_number;
        $data['contact_person'] = $company->contact_person;

        if (empty($data['customer_email'])) {
            return response()->json(['message' => 'Selected company has no email on file.'], 422);
        }

        // Resolve full name from client, custom name, or legacy parts
        $data = $this->resolveCustomerName($data, $company->company_name ?? '');

        // Resolve combined address strings from structured parts
        $data = $this->resolveAddresses($data);

        // Official PSGC labels replace client-supplied labels. Coordinates are
        // always resolved and persisted by the server before the job is created.
        $data = array_merge($data, $this->addresses->normalize($data, 'pickup', true, false));
        $data = array_merge($data, $this->addresses->normalize($data, 'dropoff', true, false));

        JobOrderAddressValidator::validatePayload($data);

        $data['created_by']         = $request->user()?->id;
        $data['customer_user_id']   = $this->companyService->resolveCustomerUserIdForCompany($company);
        $data['job_requirements']   = $data['job_requirements'] ?? $data['special_handling_instructions'] ?? null;
        $data['volume_m3']          = $data['volume_m3'] ?? $data['load_volume_m3'];
        $data['tracking_code']      = strtoupper(Str::random(10));
        $data['status']             = 'pending';
        $data['priority']           = $data['priority'] ?? 'normal';

        // Strip non-column helper fields before persisting.
        unset(
            $data['client_mode'],
            $data['save_as_client'],
            $data['contact_person'],
            $data['client_id'],
            $data['pickup_coordinate_confirmation_token'],
            $data['dropoff_coordinate_confirmation_token'],
        );

        $jobOrder = JobOrder::create($data);
        $this->confirmedLocations->recordStored($jobOrder->pickup_geocoding_trace_id, $jobOrder, 'pickup');
        $this->confirmedLocations->recordStored($jobOrder->dropoff_geocoding_trace_id, $jobOrder, 'dropoff');

        AuditLogger::record($request->user(), 'job_order.created', JobOrder::class, $jobOrder->id, [
            'tracking_code' => $jobOrder->tracking_code,
            'company_id'     => $jobOrder->company_id,
            'client_id'     => $jobOrder->company_id,
            'custom_client' => (bool) $request->input('custom_client_name'),
        ], $request);

        return response()->json($jobOrder->fresh()->load('company', 'client', 'quarry', 'preferredVehicleType', 'materialTypeRef', 'materialSpecification'), 201);
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
            'client_id'                  => 'sometimes|nullable|exists:companies,id',
            'company_id'                 => 'sometimes|nullable|exists:companies,id',
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
            'pickup_region_code'         => 'sometimes|nullable|string|size:10',
            'pickup_province_code'       => 'sometimes|nullable|string|size:10',
            'pickup_city_code'           => 'sometimes|nullable|string|size:10',
            'pickup_barangay_code'       => 'sometimes|nullable|string|size:10',
            'pickup_province'            => 'sometimes|nullable|string|max:100',
            'pickup_city'                => 'sometimes|nullable|string|max:100',
            'pickup_barangay'            => 'nullable|string|max:100',
            'pickup_street'              => 'sometimes|nullable|string|max:255',
            'pickup_landmark'            => 'nullable|string|max:255',
            // legacy fallback
            'pickup_location'            => 'sometimes|nullable|string',
            'pickup_coordinate_confirmation_token' => 'sometimes|nullable|string',
            // structured drop-off
            'dropoff_region_code'        => 'sometimes|nullable|string|size:10',
            'dropoff_province_code'      => 'sometimes|nullable|string|size:10',
            'dropoff_city_code'          => 'sometimes|nullable|string|size:10',
            'dropoff_barangay_code'      => 'sometimes|nullable|string|size:10',
            'dropoff_province'           => 'sometimes|nullable|string|max:100',
            'dropoff_city'               => 'sometimes|nullable|string|max:100',
            'dropoff_barangay'           => 'nullable|string|max:100',
            'dropoff_street'             => 'sometimes|nullable|string|max:255',
            'dropoff_landmark'           => 'nullable|string|max:255',
            // legacy fallback
            'dropoff_location'           => 'sometimes|nullable|string',
            'dropoff_coordinate_confirmation_token' => 'sometimes|nullable|string',
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
            'status'                     => 'nullable|in:pending,assigned,en_route_to_pickup,arrived_at_pickup,en_route_to_destination,in_progress,arrived,completed,delivered,cancelled',
        ]);

        JobOrderScheduleValidator::validatePayload($data);

        $materialFields = ['material_type_id', 'custom_material_type_name', 'material_specification_id', 'custom_specification_name'];
        if (count(array_intersect(array_keys($data), $materialFields)) > 0) {
            $merged = array_merge($jobOrder->only(['material_type_id', 'material_specification_id']), $data);
            $data = array_merge($data, $this->materialMasterData->resolveJobOrderMaterials($merged));
        }

        if (array_key_exists('client_id', $data) || array_key_exists('company_id', $data) || array_key_exists('custom_client_name', $data)) {
            if (array_key_exists('client_id', $data) && ! array_key_exists('company_id', $data)) {
                $data['company_id'] = $data['client_id'];
            }
            $data = $this->normalizeClientInput($data);
            if (! empty($data['company_id']) || ! empty($data['client_id'])) {
                $data['company_id'] = $data['company_id'] ?? $data['client_id'];
                $data['custom_client_name'] = null;
            }
        }
        unset($data['client_id']);

        // Keep structured name fields in sync with legacy customer_name
        $nameFields = ['customer_first_name', 'customer_middle_name', 'customer_last_name', 'customer_suffix', 'customer_name', 'custom_client_name'];
        if (count(array_intersect(array_keys($data), $nameFields)) > 0) {
            $merged = array_merge($jobOrder->only($nameFields), $data);
            $data = array_merge($data, $this->resolveCustomerName($merged, $jobOrder->customer_name ?? ''));
        }

        // Keep structured address fields in sync with legacy combined fields
        $pickupFields = ['pickup_region_code', 'pickup_province_code', 'pickup_city_code', 'pickup_barangay_code', 'pickup_province', 'pickup_city', 'pickup_barangay', 'pickup_street', 'pickup_landmark', 'pickup_location'];
        $dropoffFields = ['dropoff_region_code', 'dropoff_province_code', 'dropoff_city_code', 'dropoff_barangay_code', 'dropoff_province', 'dropoff_city', 'dropoff_barangay', 'dropoff_street', 'dropoff_landmark', 'dropoff_location'];
        $addrFields = array_merge($pickupFields, $dropoffFields);
        $pickupChanged = count(array_intersect(array_keys($data), $pickupFields)) > 0
            || (array_key_exists('quarry_id', $data) && (int) ($data['quarry_id'] ?? 0) !== (int) ($jobOrder->quarry_id ?? 0));
        $dropoffChanged = count(array_intersect(array_keys($data), $dropoffFields)) > 0;
        if ($pickupChanged || $dropoffChanged) {
            $merged = array_merge($jobOrder->only($addrFields), $data);

            if ($pickupChanged) {
                if (! empty($merged['pickup_region_code'])) {
                    $data = array_merge($data, $this->addresses->normalize($merged, 'pickup', false, true));
                } elseif ($this->addressActuallyChanged($jobOrder, $data, $pickupFields)) {
                    throw ValidationException::withMessages([
                        'pickup_address' => ['Select the pickup address from the PSGC geographic directory.'],
                    ]);
                }
            }

            if ($dropoffChanged) {
                if (! empty($merged['dropoff_region_code'])) {
                    $data = array_merge($data, $this->addresses->normalize($merged, 'dropoff', false, true));
                } elseif ($this->addressActuallyChanged($jobOrder, $data, $dropoffFields)) {
                    throw ValidationException::withMessages([
                        'dropoff_address' => ['Select the destination address from the PSGC geographic directory.'],
                    ]);
                }
            }

            if (empty($merged['pickup_region_code']) || empty($merged['dropoff_region_code'])) {
                $data = array_merge($data, $this->resolveAddresses(array_merge($merged, $data)));
            }
            JobOrderAddressValidator::validatePayload(array_merge(
                $jobOrder->only(array_merge($addrFields, ['quarry_id'])),
                $data,
            ));
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

        $trackFields = ['status', 'priority', 'scheduled_start', 'scheduled_end', 'customer_name', 'company_id'];
        $before = $jobOrder->only($trackFields);

        $previousStatus = $jobOrder->status;
        unset($data['pickup_coordinate_confirmation_token'], $data['dropoff_coordinate_confirmation_token']);
        $jobOrder->update($data);

        if (($data['status'] ?? null) === 'cancelled' && $previousStatus !== 'cancelled') {
            $this->driverAvailability->cancelActiveAssignmentsForJobOrder(
                $jobOrder->id,
                'job_order_cancelled',
                $request->user()?->id,
            );
        }

        if ($pickupChanged || $dropoffChanged) {
            $stored = $jobOrder->fresh();
            if ($pickupChanged) {
                $this->confirmedLocations->recordStored($stored->pickup_geocoding_trace_id, $stored, 'pickup');
            }
            if ($dropoffChanged) {
                $this->confirmedLocations->recordStored($stored->dropoff_geocoding_trace_id, $stored, 'dropoff');
            }
        }

        $after = $jobOrder->fresh()->only($trackFields);
        $changes = AuditChangeTracker::diffArrays($before, $after, $trackFields);

        if (($data['status'] ?? null) === 'cancelled' && $previousStatus !== 'cancelled') {
            AuditLogger::record($request->user(), 'job_order.cancelled', JobOrder::class, $jobOrder->id, [
                'tracking_code' => $jobOrder->tracking_code,
                'changes' => ['status' => ['old' => $previousStatus, 'new' => 'cancelled']],
            ], $request);
        } else {
            AuditLogger::recordChanges(
                $request->user(),
                'job_order.updated',
                JobOrder::class,
                $jobOrder->id,
                $changes,
                ['tracking_code' => $jobOrder->tracking_code],
                $request,
            );
        }

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
        if ($jobOrder->is_archived) {
            return response()->json(['message' => 'Job order is already archived.'], 409);
        }

        if (in_array($jobOrder->status, [
            'in_progress',
            DeliveryStatus::EN_ROUTE_TO_PICKUP,
            DeliveryStatus::ARRIVED_AT_PICKUP,
            DeliveryStatus::EN_ROUTE_TO_DESTINATION,
            DeliveryStatus::ARRIVED,
        ], true)) {
            return response()->json(['message' => 'Cannot archive a job that is currently in progress.'], 422);
        }

        foreach ($jobOrder->assignments()->whereIn('status', DeliveryStatus::availabilityBlockingRawValues())->get() as $assignment) {
            $assignment->update(['status' => DeliveryStatus::CANCELLED]);
            $this->resourceSync->syncForAssignment(
                $assignment,
                'job_order_archived',
                $request->user()?->id,
            );
        }

        $jobOrder->update([
            'is_archived' => true,
            'archived_at' => now(),
        ]);

        AuditLogger::record($request->user(), 'job_order.archived', JobOrder::class, $jobOrder->id, [
            'tracking_code' => $jobOrder->tracking_code,
            'status'        => $jobOrder->status,
        ], $request);

        return response()->json(['message' => 'Job order archived.']);
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

    /** @param list<string> $fields */
    private function addressActuallyChanged(JobOrder $jobOrder, array $data, array $fields): bool
    {
        foreach ($fields as $field) {
            if (array_key_exists($field, $data)
                && (string) ($data[$field] ?? '') !== (string) ($jobOrder->{$field} ?? '')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Build combined pickup_location / dropoff_location strings from structured
     * address parts, and vice versa. Both the structured and legacy fields are
     * always populated so old queries that read pickup_location still work.
     */
    private function resolveAddresses(array $data): array
    {
        if (! empty($data['pickup_street']) || ! empty($data['pickup_city'])) {
            $data['pickup_location'] = JobOrderAddressFormatter::formatParts([
                $data['pickup_street']   ?? null,
                $data['pickup_barangay'] ?? null,
                $data['pickup_city']     ?? null,
                $data['pickup_province'] ?? null,
            ]);
        }

        if (! empty($data['dropoff_street']) || ! empty($data['dropoff_city'])) {
            $data['dropoff_location'] = JobOrderAddressFormatter::formatParts([
                $data['dropoff_street']   ?? null,
                $data['dropoff_barangay'] ?? null,
                $data['dropoff_city']     ?? null,
                $data['dropoff_province'] ?? null,
            ]);
        }

        return $data;
    }
}
