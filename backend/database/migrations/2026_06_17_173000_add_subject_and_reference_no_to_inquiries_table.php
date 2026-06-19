<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inquiries', function (Blueprint $table) {
            if (! Schema::hasColumn('inquiries', 'subject')) {
                $table->string('subject', 200)->nullable()->after('inquiry_type');
            }
            if (! Schema::hasColumn('inquiries', 'reference_no')) {
                $table->string('reference_no', 32)->nullable()->after('subject')->unique();
            }
        });
    }

    public function down(): void
    {
        Schema::table('inquiries', function (Blueprint $table) {
            if (Schema::hasColumn('inquiries', 'reference_no')) {
                $table->dropUnique(['reference_no']);
                $table->dropColumn('reference_no');
            }
            if (Schema::hasColumn('inquiries', 'subject')) {
                $table->dropColumn('subject');
            }
        });
    }
};

