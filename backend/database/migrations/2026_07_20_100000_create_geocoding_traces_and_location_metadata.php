<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('geocoding_traces', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('context', 40)->index();
            $table->text('raw_input');
            $table->text('normalized_address');
            $table->string('provider', 40)->nullable()->index();
            $table->text('request_url')->nullable();
            $table->json('request_payload')->nullable();
            $table->json('response_payload')->nullable();
            $table->json('candidates')->nullable();
            $table->json('selected_candidate')->nullable();
            $table->string('selection_reason', 80)->nullable();
            $table->decimal('selected_latitude', 10, 7)->nullable();
            $table->decimal('selected_longitude', 10, 7)->nullable();
            $table->nullableMorphs('record');
            $table->decimal('stored_latitude', 10, 7)->nullable();
            $table->decimal('stored_longitude', 10, 7)->nullable();
            $table->decimal('api_latitude', 10, 7)->nullable();
            $table->decimal('api_longitude', 10, 7)->nullable();
            $table->decimal('rendered_latitude', 10, 7)->nullable();
            $table->decimal('rendered_longitude', 10, 7)->nullable();
            $table->string('status', 30)->default('searched')->index();
            $table->text('error_message')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('rendered_at')->nullable();
            $table->timestamps();
            $table->index('created_at');
        });

        Schema::table('job_orders', function (Blueprint $table) {
            foreach (['pickup', 'dropoff'] as $prefix) {
                $table->uuid("{$prefix}_geocoding_trace_id")->nullable()->index();
                $table->string("{$prefix}_coordinate_source", 40)->nullable();
                $table->string("{$prefix}_coordinate_provider", 40)->nullable();
                $table->string("{$prefix}_coordinate_place_id", 255)->nullable();
                $table->text("{$prefix}_coordinate_label")->nullable();
                $table->timestamp("{$prefix}_coordinate_confirmed_at")->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            foreach (['pickup', 'dropoff'] as $prefix) {
                $table->dropColumn([
                    "{$prefix}_geocoding_trace_id",
                    "{$prefix}_coordinate_source",
                    "{$prefix}_coordinate_provider",
                    "{$prefix}_coordinate_place_id",
                    "{$prefix}_coordinate_label",
                    "{$prefix}_coordinate_confirmed_at",
                ]);
            }
        });

        Schema::dropIfExists('geocoding_traces');
    }
};
