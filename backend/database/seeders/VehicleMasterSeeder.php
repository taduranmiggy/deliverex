<?php

namespace Database\Seeders;

use App\Models\DispatchAssignment;
use App\Models\DriverVehicleAssignment;
use App\Models\Vehicle;
use App\Models\VehicleType;
use Illuminate\Database\Seeder;

class VehicleMasterSeeder extends Seeder
{
    public function run(): void
    {
        // Resolve master vehicle types by their unique display name so the FK link is
        // always established even if wheel_type metadata drifts.
        $tenWheelerType = VehicleType::query()->where('name', '10-Wheeler')->first();
        $adtType = VehicleType::query()->where('name', 'ADT')->first();

        $tenWheelers = [
            'CBS 6496' => 14.63,
            'CBS 4908' => 13.99,
            'CCB 9083' => 13.99,
            'CCI 3747' => 13.99,
            'NES 3733' => 14.63,
            'NIC 8346' => 13.92,
            'CAH 1701' => 13.84,
            'NGK 4977' => 13.99,
            'NIM 8467' => 13.99,
            'CBS 7861' => 14.63,
            'RCS 7808' => 14.63,
            'NGL 8955' => 13.91,
            'CBA 5090' => 13.79,
            'NDO 3476' => 13.79,
            'CCK 3641' => 13.90,
            'NHF 5537' => 14.63,
            'NIG 8463' => 14.63,
            'CCK 7361' => 14.63,
            'CCO 3696' => 13.90,
            'CCB 9027' => 13.91,
            'NHF 5349' => 14.68,
            'CBR 4958' => 13.99,
            'CBA 3337' => 14.63,
            'CCK 6106' => 14.63,
            'CCE 5173' => 14.63,
            'CAM 3269' => 14.63,
            'CAB 3356' => 14.63,
            'CBN 1168' => 14.63,
            'CBS 6331' => 14.63,
            'NEU 3735' => 13.90,
        ];
        $adts = [
            'NBL 9758' => 39.10,
            'NAQ 7586' => 37.15,
            'NBC 5319' => 33.81,
            'NBR 6282' => 35.19,
            'NBR 6283' => 37.15,
            'NBI 6727' => 37.15,
            'NBL 6663' => 36.75,
            'NBL 6662' => 39.10,
            'NAK 1057' => 34.78,
            'NDP 1928' => 35.26,
        ];

        foreach ($tenWheelers as $plateNo => $cbmCapacity) {
            $this->upsertVehicle(
                plateNo: $plateNo,
                vehicleTypeId: $tenWheelerType?->id,
                displayType: '10-Wheeler',
                cbmCapacity: $cbmCapacity
            );
        }

        foreach ($adts as $plateNo => $cbmCapacity) {
            $this->upsertVehicle(
                plateNo: $plateNo,
                vehicleTypeId: $adtType?->id,
                displayType: 'ADT',
                cbmCapacity: $cbmCapacity
            );
        }

        $this->cleanupNonClientVehicles(array_merge(array_keys($tenWheelers), array_keys($adts)));
    }

    private function upsertVehicle(
        string $plateNo,
        ?int $vehicleTypeId,
        string $displayType,
        float $cbmCapacity
    ): void {
        $plateNo = strtoupper(trim($plateNo));
        $cbm = round($cbmCapacity, 3);

        Vehicle::updateOrCreate(
            ['plate_no' => $plateNo],
            [
                'vehicle_type_id' => $vehicleTypeId,
                'type' => $displayType,
                'capacity' => $this->formatCbmLabel($cbm),
                'raw_cbm_value' => round($cbm * 1_000_000, 3),
                'cbm_capacity' => $cbm,
                'rounded_cbm_capacity' => (int) round($cbm),
                'max_volume_m3' => $cbm,
                'status' => 'available',
            ]
        );
    }

    private function formatCbmLabel(float $cbm): string
    {
        return rtrim(rtrim(number_format($cbm, 2, '.', ''), '0'), '.').' m3';
    }

    /**
     * Remove stale demo/faker vehicles. If already linked to assignments, archive instead.
     */
    private function cleanupNonClientVehicles(array $validPlates): void
    {
        $validPlates = array_map(fn (string $plate) => strtoupper(trim($plate)), $validPlates);

        $nonClientVehicles = Vehicle::query()
            ->whereNotIn('plate_no', $validPlates)
            ->get();

        foreach ($nonClientVehicles as $vehicle) {
            if (! $vehicle instanceof Vehicle) {
                continue;
            }

            $hasAssignments = DispatchAssignment::query()
                ->where('vehicle_id', $vehicle->id)
                ->exists();

            if ($hasAssignments) {
                $vehicle->update(['status' => 'inactive']);
                continue;
            }

            DriverVehicleAssignment::query()
                ->where('vehicle_id', $vehicle->id)
                ->delete();

            $vehicle->delete();
        }
    }
}
