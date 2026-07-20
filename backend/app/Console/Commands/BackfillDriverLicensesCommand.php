<?php

namespace App\Console\Commands;

use App\Services\Driver\DriverLicenseBackfillService;
use Illuminate\Console\Command;

class BackfillDriverLicensesCommand extends Command
{
    protected $signature = 'drivers:backfill-licenses {--dry-run : Preview generated numbers without saving}';

    protected $description = 'Generate Philippine-format LTO license numbers for drivers missing license_no';

    public function handle(DriverLicenseBackfillService $service): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $result = $service->backfillMissingLicenses($dryRun);

        if ($result['updated'] === 0) {
            $this->info('No drivers needed a generated license number.');

            return self::SUCCESS;
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

        return self::SUCCESS;
    }
}
