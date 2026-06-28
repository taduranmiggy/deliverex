<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $maps = [
            'pending' => 'assigned',
            'en route' => 'en_route_to_destination',
            'en_route' => 'en_route_to_destination',
            'in_progress' => 'en_route_to_destination',
            'delivered' => 'completed',
        ];

        foreach ($maps as $from => $to) {
            DB::table('dispatch_assignments')->where('status', $from)->update(['status' => $to]);
            DB::table('delivery_status_logs')->where('status', $from)->update(['status' => $to]);
            if ($from !== 'pending') {
                DB::table('job_orders')->where('status', $from)->update(['status' => $to]);
            }
        }
    }

    public function down(): void
    {
        $reverse = [
            'assigned' => 'pending',
            'en_route_to_destination' => 'in_progress',
            'completed' => 'delivered',
        ];

        foreach ($reverse as $from => $to) {
            DB::table('dispatch_assignments')->where('status', $from)->update(['status' => $to]);
            DB::table('delivery_status_logs')->where('status', $from)->update(['status' => $to]);
            if ($from !== 'assigned') {
                DB::table('job_orders')->where('status', $from)->update(['status' => $to]);
            }
        }
    }
};
