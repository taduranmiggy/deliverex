<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('clients') && ! Schema::hasTable('companies')) {
            Schema::rename('clients', 'companies');
        }

        if (Schema::hasTable('companies')) {
            Schema::table('companies', function (Blueprint $table) {
                if (Schema::hasColumn('companies', 'client_name')) {
                    $table->renameColumn('client_name', 'company_name');
                }
                if (Schema::hasColumn('companies', 'email')) {
                    $table->renameColumn('email', 'company_email');
                }
                if (Schema::hasColumn('companies', 'phone')) {
                    $table->renameColumn('phone', 'contact_number');
                }
            });

            Schema::table('companies', function (Blueprint $table) {
                if (! Schema::hasColumn('companies', 'activation_token')) {
                    $table->string('activation_token', 64)->nullable()->unique()->after('status');
                }
                if (! Schema::hasColumn('companies', 'activation_expires_at')) {
                    $table->timestamp('activation_expires_at')->nullable()->after('activation_token');
                }
                if (! Schema::hasColumn('companies', 'created_by')) {
                    $table->foreignId('created_by')->nullable()->after('activation_expires_at')->constrained('users')->nullOnDelete();
                }
            });

            DB::table('companies')->where('status', 'active')->update(['status' => 'active']);
            DB::table('companies')->whereNotIn('status', ['pending_activation', 'active', 'inactive', 'archived'])
                ->update(['status' => 'active']);
        }

        if (Schema::hasTable('client_quarry_vehicle_preferences') && ! Schema::hasTable('company_quarry_vehicle_preferences')) {
            Schema::rename('client_quarry_vehicle_preferences', 'company_quarry_vehicle_preferences');
        }

        if (Schema::hasTable('company_quarry_vehicle_preferences') && Schema::hasColumn('company_quarry_vehicle_preferences', 'client_id')) {
            Schema::table('company_quarry_vehicle_preferences', function (Blueprint $table) {
                $table->renameColumn('client_id', 'company_id');
            });
        }

        if (Schema::hasColumn('job_orders', 'client_id') && ! Schema::hasColumn('job_orders', 'company_id')) {
            Schema::table('job_orders', function (Blueprint $table) {
                $table->renameColumn('client_id', 'company_id');
            });
        }

        if (! Schema::hasTable('company_users')) {
            Schema::create('company_users', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->restrictOnDelete();
                $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
                $table->string('role', 20)->default('owner');
                $table->boolean('is_active')->default(true);
                $table->boolean('force_password_change')->default(false);
                $table->timestamp('last_login')->nullable();
                $table->timestamps();
                $table->unique(['company_id', 'user_id']);
                $table->index(['company_id', 'role']);
            });
        }

        $this->backfillJobOrdersByEmail();
        $this->backfillCompanyUsers();
    }

    private function backfillJobOrdersByEmail(): void
    {
        if (! Schema::hasTable('job_orders') || ! Schema::hasTable('companies')) {
            return;
        }

        $orders = DB::table('job_orders')
            ->whereNull('company_id')
            ->whereNotNull('customer_email')
            ->where('customer_email', '!=', '')
            ->get(['id', 'customer_email']);

        foreach ($orders as $order) {
            $companyId = DB::table('companies')
                ->whereRaw('LOWER(company_email) = ?', [strtolower(trim($order->customer_email))])
                ->value('id');

            if ($companyId) {
                DB::table('job_orders')->where('id', $order->id)->update(['company_id' => $companyId]);
            }
        }
    }

    private function backfillCompanyUsers(): void
    {
        if (! Schema::hasTable('company_users') || ! Schema::hasTable('roles')) {
            return;
        }

        $customerRoleId = DB::table('roles')->where('name', 'customer')->value('id');
        if (! $customerRoleId) {
            return;
        }

        $customers = DB::table('users')->where('role_id', $customerRoleId)->get(['id', 'email']);

        foreach ($customers as $customer) {
            if (DB::table('company_users')->where('user_id', $customer->id)->exists()) {
                continue;
            }

            $companyId = DB::table('companies')
                ->whereRaw('LOWER(company_email) = ?', [strtolower(trim($customer->email))])
                ->value('id');

            if (! $companyId) {
                $companyId = DB::table('job_orders')
                    ->where('customer_user_id', $customer->id)
                    ->whereNotNull('company_id')
                    ->value('company_id');
            }

            if ($companyId) {
                DB::table('company_users')->insert([
                    'company_id' => $companyId,
                    'user_id' => $customer->id,
                    'role' => 'owner',
                    'is_active' => true,
                    'force_password_change' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('company_users');

        if (Schema::hasColumn('job_orders', 'company_id') && ! Schema::hasColumn('job_orders', 'client_id')) {
            Schema::table('job_orders', function (Blueprint $table) {
                $table->renameColumn('company_id', 'client_id');
            });
        }

        if (Schema::hasTable('company_quarry_vehicle_preferences') && ! Schema::hasTable('client_quarry_vehicle_preferences')) {
            if (Schema::hasColumn('company_quarry_vehicle_preferences', 'company_id')) {
                Schema::table('company_quarry_vehicle_preferences', function (Blueprint $table) {
                    $table->renameColumn('company_id', 'client_id');
                });
            }
            Schema::rename('company_quarry_vehicle_preferences', 'client_quarry_vehicle_preferences');
        }

        if (Schema::hasTable('companies') && ! Schema::hasTable('clients')) {
            Schema::table('companies', function (Blueprint $table) {
                if (Schema::hasColumn('companies', 'created_by')) {
                    $table->dropConstrainedForeignId('created_by');
                }
                $table->dropColumn(['activation_token', 'activation_expires_at']);
            });

            Schema::table('companies', function (Blueprint $table) {
                if (Schema::hasColumn('companies', 'company_name')) {
                    $table->renameColumn('company_name', 'client_name');
                }
                if (Schema::hasColumn('companies', 'company_email')) {
                    $table->renameColumn('company_email', 'email');
                }
                if (Schema::hasColumn('companies', 'contact_number')) {
                    $table->renameColumn('contact_number', 'phone');
                }
            });

            Schema::rename('companies', 'clients');
        }
    }
};
