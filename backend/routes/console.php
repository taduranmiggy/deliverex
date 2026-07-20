<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Models\JobOrder;
use App\Services\Delivery\JobOrderLocationService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('addresses:geocode-legacy {--limit=500}', function () {
    $limit = max(1, min(5000, (int) $this->option('limit')));
    $service = app(JobOrderLocationService::class);
    $processed = 0;

    JobOrder::query()
        ->where(function ($query) {
            $query->where(function ($pickup) {
                $pickup->where(function ($coordinates) {
                    $coordinates->whereNull('pickup_latitude')->orWhereNull('pickup_longitude');
                });
            })->orWhere(function ($dropoff) {
                $dropoff->where(function ($coordinates) {
                    $coordinates->whereNull('dropoff_latitude')->orWhereNull('dropoff_longitude');
                });
            });
        })
        ->orderBy('id')
        ->limit($limit)
        ->get()
        ->each(function (JobOrder $jobOrder) use ($service, &$processed) {
            $service->ensureCoordinates($jobOrder, retryMissing: true);
            $processed++;
            $this->line("Processed job order {$jobOrder->id}.");
        });

    $this->info("Legacy geocoding finished: {$processed} job order(s) attempted.");
})->purpose('Attempt missing legacy job-order coordinates once and persist the result');

Artisan::command('drivers:backfill-licenses {--dry-run : Preview generated numbers without saving}', function () {
    $dryRun = (bool) $this->option('dry-run');
    $result = app(\App\Services\Driver\DriverLicenseBackfillService::class)->backfillMissingLicenses($dryRun);

    if ($result['updated'] === 0) {
        $this->info('No drivers needed a generated license number.');

        return 0;
    }

    $this->table(
        ['Driver ID', 'Name', 'License No.'],
        collect($result['licenses'])->map(fn (array $row) => [
            $row['driver_id'],
            $row['full_name'] ?? '—',
            $row['license_no'],
        ])->all(),
    );

    $verb = $dryRun ? 'Would update' : 'Updated';
    $this->info(sprintf(
        '%s %d driver(s); skipped %d with existing license numbers.',
        $verb,
        $result['updated'],
        $result['skipped'],
    ));

    if ($dryRun) {
        $this->comment('Run without --dry-run to save changes.');
    }

    return 0;
})->purpose('Generate Philippine-format LTO license numbers for drivers missing license_no');
