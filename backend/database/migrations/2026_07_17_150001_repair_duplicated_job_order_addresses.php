<?php

use App\Models\JobOrder;
use App\Support\JobOrderAddressFormatter;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        JobOrder::query()->each(function (JobOrder $jobOrder) {
            $updates = [];

            foreach (['pickup', 'dropoff'] as $prefix) {
                $repaired = JobOrderAddressFormatter::repairStructured(
                    $jobOrder->{"{$prefix}_street"},
                    $jobOrder->{"{$prefix}_barangay"},
                    $jobOrder->{"{$prefix}_city"},
                    $jobOrder->{"{$prefix}_province"},
                    $jobOrder->{"{$prefix}_location"},
                );

                foreach (['street', 'barangay', 'city', 'province'] as $part) {
                    $column = "{$prefix}_{$part}";
                    $value = $repaired[$part] ?: null;
                    if ($jobOrder->{$column} !== $value) {
                        $updates[$column] = $value;
                    }
                }

                $locationColumn = "{$prefix}_location";
                if ($jobOrder->{$locationColumn} !== $repaired['location']) {
                    $updates[$locationColumn] = $repaired['location'] ?: null;
                }
            }

            if ($updates !== []) {
                $jobOrder->update($updates);
            }
        });
    }

    public function down(): void
    {
        // Data repair migration — no rollback.
    }
};
