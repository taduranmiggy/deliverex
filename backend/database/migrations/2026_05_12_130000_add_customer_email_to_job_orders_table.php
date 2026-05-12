<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('job_orders', 'customer_email')) {
                $table->string('customer_email', 255)->nullable()->after('customer_name');
                $table->index('customer_email');
            }
        });
    }

    public function down(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            if (Schema::hasColumn('job_orders', 'customer_email')) {
                $table->dropIndex(['customer_email']);
                $table->dropColumn('customer_email');
            }
        });
    }
};
