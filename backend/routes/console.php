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
                $pickup->whereNull('pickup_geocode_attempted_at')
                    ->where(function ($coordinates) {
                        $coordinates->whereNull('pickup_latitude')->orWhereNull('pickup_longitude');
                    });
            })->orWhere(function ($dropoff) {
                $dropoff->whereNull('dropoff_geocode_attempted_at')
                    ->where(function ($coordinates) {
                        $coordinates->whereNull('dropoff_latitude')->orWhereNull('dropoff_longitude');
                    });
            });
        })
        ->orderBy('id')
        ->limit($limit)
        ->get()
        ->each(function (JobOrder $jobOrder) use ($service, &$processed) {
            $service->ensureCoordinates($jobOrder);
            $processed++;
            $this->line("Processed job order {$jobOrder->id}.");
        });

    $this->info("Legacy geocoding finished: {$processed} job order(s) attempted.");
})->purpose('Attempt missing legacy job-order coordinates once and persist the result');
