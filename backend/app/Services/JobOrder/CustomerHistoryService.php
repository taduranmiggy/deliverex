<?php

namespace App\Services\JobOrder;

use App\Models\Client;
use App\Models\ClientQuarryVehiclePreference;
use App\Models\DispatchAssignment;
use App\Models\JobOrder;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class CustomerHistoryService
{
    public function analyze(Client $client, ?int $excludeJobOrderId = null): array
    {
        $orders = JobOrder::query()
            ->where('client_id', $client->id)
            ->when($excludeJobOrderId, fn ($q) => $q->where('id', '!=', $excludeJobOrderId))
            ->where('status', '!=', 'cancelled')
            ->with(['quarry', 'preferredVehicleType', 'materialTypeRef', 'materialSpecification'])
            ->orderByDesc('created_at')
            ->get();

        $preference = ClientQuarryVehiclePreference::query()
            ->where('client_id', $client->id)
            ->where('status', 'active')
            ->where('is_default', true)
            ->with(['quarry', 'vehicleType'])
            ->first();

        $quarryId = $this->modeId($orders, 'quarry_id');
        $materialTypeId = $this->modeId($orders, 'material_type_id');
        $specId = $materialTypeId
            ? $this->modeId($orders->where('material_type_id', $materialTypeId), 'material_specification_id')
            : null;
        $vehicleTypeId = $this->modeId($orders, 'preferred_vehicle_type_id');

        $topQuarry = $quarryId ? $orders->firstWhere('quarry_id', $quarryId)?->quarry : null;
        $topMaterial = $materialTypeId ? $orders->firstWhere('material_type_id', $materialTypeId)?->materialTypeRef : null;
        $topSpec = $specId ? $orders->firstWhere('material_specification_id', $specId)?->materialSpecification : null;
        $topVehicle = $vehicleTypeId ? $orders->firstWhere('preferred_vehicle_type_id', $vehicleTypeId)?->preferredVehicleType : null;

        $recent = $orders->first();
        $lastDelivery = DispatchAssignment::query()
            ->whereHas('jobOrder', fn ($q) => $q->where('client_id', $client->id))
            ->where('status', 'completed')
            ->whereNotNull('completed_at')
            ->orderByDesc('completed_at')
            ->value('completed_at');

        if (! $lastDelivery && $orders->where('status', 'completed')->isNotEmpty()) {
            $lastDelivery = $orders->where('status', 'completed')
                ->sortByDesc(fn ($o) => $o->scheduled_end ?? $o->updated_at)
                ->first()
                ?->scheduled_end;
        }

        $autoFill = $this->buildAutoFill($orders, $preference, $quarryId, $materialTypeId, $specId, $vehicleTypeId, $recent);

        return [
            'client_id'        => $client->id,
            'total_orders'     => $orders->count(),
            'preferred_quarry' => $topQuarry ? [
                'id'   => $topQuarry->id,
                'name' => $topQuarry->quarry_name,
            ] : ($preference?->quarry ? [
                'id'   => $preference->quarry->id,
                'name' => $preference->quarry->quarry_name,
            ] : null),
            'most_used_material' => $topMaterial ? [
                'id'                  => $topMaterial->id,
                'name'                => $topMaterial->name,
                'specification_id'    => $topSpec?->id,
                'specification_name'  => $topSpec?->name ?? $recent?->specification_size,
            ] : null,
            'most_used_vehicle_type' => $topVehicle ? [
                'id'   => $topVehicle->id,
                'name' => $topVehicle->name,
            ] : ($preference?->vehicleType ? [
                'id'   => $preference->vehicleType->id,
                'name' => $preference->vehicleType->name,
            ] : null),
            'last_delivery_date' => $lastDelivery
                ? Carbon::parse($lastDelivery)->toIso8601String()
                : null,
            'auto_fill'          => $autoFill,
        ];
    }

    private function buildAutoFill(
        Collection $orders,
        ?ClientQuarryVehiclePreference $preference,
        ?int $quarryId,
        ?int $materialTypeId,
        ?int $specId,
        ?int $vehicleTypeId,
        ?JobOrder $recent
    ): array {
        $resolvedQuarry = $quarryId ?? $preference?->quarry_id ?? $recent?->quarry_id;
        $resolvedVehicle = $vehicleTypeId ?? $preference?->vehicle_type_id ?? $recent?->preferred_vehicle_type_id;
        $resolvedMaterial = $materialTypeId ?? $recent?->material_type_id;
        $resolvedSpec = $specId ?? $recent?->material_specification_id;
        $resolvedVolume = $recent?->load_volume_m3 ?? $recent?->volume_m3;

        $autoFill = array_filter([
            'quarry_id'                 => $resolvedQuarry,
            'preferred_vehicle_type_id' => $resolvedVehicle,
            'material_type_id'          => $resolvedMaterial,
            'material_specification_id' => $resolvedSpec,
            'load_volume_m3'            => $resolvedVolume !== null ? (float) $resolvedVolume : null,
            'dropoff_province'          => $recent?->dropoff_province,
            'dropoff_city'              => $recent?->dropoff_city,
            'dropoff_barangay'          => $recent?->dropoff_barangay,
            'dropoff_street'            => $recent?->dropoff_street,
            'dropoff_landmark'          => $recent?->dropoff_landmark,
            'pickup_province'           => $recent?->pickup_province,
            'pickup_city'               => $recent?->pickup_city,
            'pickup_barangay'           => $recent?->pickup_barangay,
            'pickup_street'             => $recent?->pickup_street,
            'pickup_landmark'           => $recent?->pickup_landmark,
        ], fn ($v) => $v !== null && $v !== '');

        return array_map(fn ($v) => is_float($v) ? $v : (is_numeric($v) ? (int) $v : $v), $autoFill);
    }

    private function modeId(Collection $orders, string $column): ?int
    {
        $top = $orders->whereNotNull($column)
            ->groupBy($column)
            ->map(fn (Collection $group) => $group->count())
            ->sortDesc()
            ->keys()
            ->first();

        return $top !== null ? (int) $top : null;
    }
}
