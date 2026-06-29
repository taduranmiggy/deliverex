<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inquiries', function (Blueprint $table) {
            if (! Schema::hasColumn('inquiries', 'customer_user_id')) {
                $table->unsignedBigInteger('customer_user_id')->nullable()->after('job_order_id');
                $table->foreign('customer_user_id')->references('id')->on('users')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('inquiries', function (Blueprint $table) {
            if (Schema::hasColumn('inquiries', 'customer_user_id')) {
                $table->dropForeign(['customer_user_id']);
                $table->dropColumn('customer_user_id');
            }
        });
    }
};
