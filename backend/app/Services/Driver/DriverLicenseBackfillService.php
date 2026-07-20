<?php

namespace App\Services\Driver;

use App\Models\Driver;
use App\Support\PhilippineDriverLicenseGenerator;
use Illuminate\Support\Collection;

class DriverLicenseBackfillService
{
    /**
     * @return array{updated:int,skipped:int,licenses:list<array{driver_id:int,full_name:?string,license_no:string}>}
     */
    public function backfillMissingLicenses(bool $dryRun = false): array
    {
        $reserved = $this->existingLicenseNumbers();
        $updated = 0;
        $skipped = 0;
        $licenses = [];

        Driver::query()
            ->orderBy('id')
            ->get()
            ->each(function (Driver $driver) use (&$reserved, &$updated, &$skipped, &$licenses, $dryRun): void {
                if (! PhilippineDriverLicenseGenerator::isMissingOrPlaceholder($driver->license_no)) {
                    $skipped++;

                    return;
                }

                $licenseNo = PhilippineDriverLicenseGenerator::generateForDriver($driver->id, $reserved);
                $reserved[] = $licenseNo;

                $patch = ['license_no' => $licenseNo];
                if ($driver->license_expiry === null) {
                    $patch['license_expiry'] = now()->addYears(5)->toDateString();
                }

                if (! $dryRun) {
                    $driver->update($patch);
                }

                $licenses[] = [
                    'driver_id' => $driver->id,
                    'full_name' => $driver->full_name,
                    'license_no' => $licenseNo,
                ];
                $updated++;
            });

        return [
            'updated' => $updated,
            'skipped' => $skipped,
            'licenses' => $licenses,
        ];
    }

    /** @return list<string> */
    private function existingLicenseNumbers(): array
    {
        /** @var Collection<int, string|null> $rows */
        $rows = Driver::query()
            ->whereNotNull('license_no')
            ->pluck('license_no');

        return $rows
            ->map(fn (?string $value) => strtoupper(trim((string) $value)))
            ->filter(fn (string $value) => $value !== '')
            ->values()
            ->all();
    }
}
