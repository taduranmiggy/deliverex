<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('material_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120)->unique();
            $table->string('status', 20)->default('active');
            $table->timestamps();
        });

        Schema::create('material_specifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_type_id')->constrained('material_types')->cascadeOnDelete();
            $table->string('name', 160);
            $table->string('status', 20)->default('active');
            $table->timestamps();
            $table->unique(['material_type_id', 'name']);
        });

        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('client_name', 180)->unique();
            $table->string('contact_person', 120)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('phone', 50)->nullable();
            $table->text('address')->nullable();
            $table->string('status', 20)->default('active');
            $table->timestamps();
        });

        Schema::create('quarries', function (Blueprint $table) {
            $table->id();
            $table->string('quarry_name', 180)->unique();
            $table->string('contact_person', 120)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('phone', 50)->nullable();
            $table->text('address')->nullable();
            $table->string('status', 20)->default('active');
            $table->timestamps();
        });

        Schema::create('vehicle_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('wheel_type', 60)->nullable();
            $table->decimal('min_cbm', 10, 3)->nullable();
            $table->decimal('max_cbm', 10, 3)->nullable();
            $table->text('description')->nullable();
            $table->string('status', 20)->default('active');
            $table->timestamps();
            $table->unique(['name', 'wheel_type', 'min_cbm', 'max_cbm'], 'vehicle_types_unique_profile');
        });

        Schema::create('driver_vehicle_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained('drivers');
            $table->foreignId('vehicle_id')->constrained('vehicles');
            $table->boolean('is_primary')->default(false);
            $table->string('status', 20)->default('active');
            $table->timestamps();
            $table->unique(['driver_id', 'vehicle_id']);
        });

        Schema::create('client_quarry_vehicle_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->foreignId('quarry_id')->constrained('quarries');
            $table->foreignId('vehicle_type_id')->nullable()->constrained('vehicle_types')->nullOnDelete();
            $table->boolean('is_default')->default(true);
            $table->string('status', 20)->default('active');
            $table->timestamps();
            $table->unique(['client_id', 'quarry_id', 'vehicle_type_id'], 'client_pref_unique_profile');
        });

        Schema::table('vehicles', function (Blueprint $table) {
            if (! Schema::hasColumn('vehicles', 'vehicle_type_id')) {
                $table->foreignId('vehicle_type_id')->nullable()->after('id')->constrained('vehicle_types')->nullOnDelete();
            }
            if (! Schema::hasColumn('vehicles', 'length_cm')) {
                $table->decimal('length_cm', 10, 2)->nullable()->after('type');
            }
            if (! Schema::hasColumn('vehicles', 'width_cm')) {
                $table->decimal('width_cm', 10, 2)->nullable()->after('length_cm');
            }
            if (! Schema::hasColumn('vehicles', 'height_cm')) {
                $table->decimal('height_cm', 10, 2)->nullable()->after('width_cm');
            }
            if (! Schema::hasColumn('vehicles', 'raw_cbm_value')) {
                $table->decimal('raw_cbm_value', 14, 3)->nullable()->after('height_cm');
            }
            if (! Schema::hasColumn('vehicles', 'cbm_capacity')) {
                $table->decimal('cbm_capacity', 12, 3)->nullable()->after('raw_cbm_value');
            }
            if (! Schema::hasColumn('vehicles', 'rounded_cbm_capacity')) {
                $table->unsignedInteger('rounded_cbm_capacity')->nullable()->after('cbm_capacity');
            }
        });

        Schema::table('drivers', function (Blueprint $table) {
            if (! Schema::hasColumn('drivers', 'full_name')) {
                $table->string('full_name', 160)->nullable()->after('user_id');
            }
            if (! Schema::hasColumn('drivers', 'license_expiry')) {
                $table->date('license_expiry')->nullable()->after('license_no');
            }
            if (! Schema::hasColumn('drivers', 'status')) {
                $table->string('status', 20)->default('available')->after('availability');
            }
        });

        Schema::table('job_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('job_orders', 'client_id')) {
                $table->foreignId('client_id')->nullable()->after('customer_name')->constrained('clients')->nullOnDelete();
            }
            if (! Schema::hasColumn('job_orders', 'material_type_id')) {
                $table->foreignId('material_type_id')->nullable()->after('material_type')->constrained('material_types')->nullOnDelete();
            }
            if (! Schema::hasColumn('job_orders', 'material_specification_id')) {
                $table->foreignId('material_specification_id')->nullable()->after('specification_size')->constrained('material_specifications')->nullOnDelete();
            }
            if (! Schema::hasColumn('job_orders', 'quarry_id')) {
                $table->foreignId('quarry_id')->nullable()->after('dropoff_location')->constrained('quarries')->nullOnDelete();
            }
            if (! Schema::hasColumn('job_orders', 'load_volume_m3')) {
                $table->decimal('load_volume_m3', 12, 3)->nullable()->after('volume_m3');
            }
            if (! Schema::hasColumn('job_orders', 'special_handling_instructions')) {
                $table->text('special_handling_instructions')->nullable()->after('job_requirements');
            }
        });
    }

    public function down(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            if (Schema::hasColumn('job_orders', 'client_id')) {
                $table->dropConstrainedForeignId('client_id');
            }
            if (Schema::hasColumn('job_orders', 'material_type_id')) {
                $table->dropConstrainedForeignId('material_type_id');
            }
            if (Schema::hasColumn('job_orders', 'material_specification_id')) {
                $table->dropConstrainedForeignId('material_specification_id');
            }
            if (Schema::hasColumn('job_orders', 'quarry_id')) {
                $table->dropConstrainedForeignId('quarry_id');
            }

            $dropColumns = array_filter([
                Schema::hasColumn('job_orders', 'load_volume_m3') ? 'load_volume_m3' : null,
                Schema::hasColumn('job_orders', 'special_handling_instructions') ? 'special_handling_instructions' : null,
            ]);
            if ($dropColumns !== []) {
                $table->dropColumn($dropColumns);
            }
        });

        Schema::table('drivers', function (Blueprint $table) {
            $dropColumns = array_filter([
                Schema::hasColumn('drivers', 'full_name') ? 'full_name' : null,
                Schema::hasColumn('drivers', 'license_expiry') ? 'license_expiry' : null,
                Schema::hasColumn('drivers', 'status') ? 'status' : null,
            ]);
            if ($dropColumns !== []) {
                $table->dropColumn($dropColumns);
            }
        });

        Schema::table('vehicles', function (Blueprint $table) {
            if (Schema::hasColumn('vehicles', 'vehicle_type_id')) {
                $table->dropConstrainedForeignId('vehicle_type_id');
            }

            $dropColumns = array_filter([
                Schema::hasColumn('vehicles', 'length_cm') ? 'length_cm' : null,
                Schema::hasColumn('vehicles', 'width_cm') ? 'width_cm' : null,
                Schema::hasColumn('vehicles', 'height_cm') ? 'height_cm' : null,
                Schema::hasColumn('vehicles', 'raw_cbm_value') ? 'raw_cbm_value' : null,
                Schema::hasColumn('vehicles', 'cbm_capacity') ? 'cbm_capacity' : null,
                Schema::hasColumn('vehicles', 'rounded_cbm_capacity') ? 'rounded_cbm_capacity' : null,
            ]);
            if ($dropColumns !== []) {
                $table->dropColumn($dropColumns);
            }
        });

        Schema::dropIfExists('client_quarry_vehicle_preferences');
        Schema::dropIfExists('driver_vehicle_assignments');
        Schema::dropIfExists('vehicle_types');
        Schema::dropIfExists('quarries');
        Schema::dropIfExists('clients');
        Schema::dropIfExists('material_specifications');
        Schema::dropIfExists('material_types');
    }
};
