<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ocr_results', function (Blueprint $table) {
            $table->decimal('extracted_length', 10, 3)->nullable()->after('corrected_text');
            $table->decimal('extracted_width', 10, 3)->nullable()->after('extracted_length');
            $table->decimal('extracted_height', 10, 3)->nullable()->after('extracted_width');
            $table->decimal('extracted_volume', 12, 3)->nullable()->after('extracted_height');
            $table->string('delivery_receipt_number', 120)->nullable()->after('extracted_volume');

            $table->foreignId('assignment_id')->nullable()->after('delivery_receipt_number')->constrained('dispatch_assignments')->nullOnDelete();
            $table->foreignId('job_order_id')->nullable()->after('assignment_id')->constrained('job_orders')->nullOnDelete();
            $table->foreignId('driver_id')->nullable()->after('job_order_id')->constrained('drivers')->nullOnDelete();
            $table->string('driver_name', 160)->nullable()->after('driver_id');
            $table->string('vehicle_plate_no', 80)->nullable()->after('driver_name');
            $table->timestamp('delivery_date')->nullable()->after('vehicle_plate_no');

            $table->string('review_status', 24)->default('pending_review')->after('processing_status');
            $table->text('review_notes')->nullable()->after('error_message');
            $table->timestamp('reviewed_at')->nullable()->after('review_notes');
            $table->index('review_status');
        });
    }

    public function down(): void
    {
        Schema::table('ocr_results', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assignment_id');
            $table->dropConstrainedForeignId('job_order_id');
            $table->dropConstrainedForeignId('driver_id');
            $table->dropIndex(['review_status']);
            $table->dropColumn([
                'extracted_length',
                'extracted_width',
                'extracted_height',
                'extracted_volume',
                'delivery_receipt_number',
                'driver_name',
                'vehicle_plate_no',
                'delivery_date',
                'review_status',
                'review_notes',
                'reviewed_at',
            ]);
        });
    }
};

