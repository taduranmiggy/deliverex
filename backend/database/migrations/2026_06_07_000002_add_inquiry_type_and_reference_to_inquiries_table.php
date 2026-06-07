<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inquiries', function (Blueprint $table) {
            if (! Schema::hasColumn('inquiries', 'inquiry_type')) {
                $table->string('inquiry_type', 80)->nullable()->after('phone');
            }
            if (! Schema::hasColumn('inquiries', 'reference_job_order_id')) {
                $table->unsignedBigInteger('reference_job_order_id')->nullable()->after('inquiry_type');
                $table->foreign('reference_job_order_id')
                    ->references('id')
                    ->on('job_orders')
                    ->onDelete('set null');
            }
        });
    }

    public function down(): void
    {
        Schema::table('inquiries', function (Blueprint $table) {
            if (Schema::hasColumn('inquiries', 'reference_job_order_id')) {
                $table->dropForeign(['reference_job_order_id']);
            }

            $drops = array_filter([
                Schema::hasColumn('inquiries', 'inquiry_type') ? 'inquiry_type' : null,
                Schema::hasColumn('inquiries', 'reference_job_order_id') ? 'reference_job_order_id' : null,
            ]);
            if ($drops) {
                $table->dropColumn(array_values($drops));
            }
        });
    }
};
