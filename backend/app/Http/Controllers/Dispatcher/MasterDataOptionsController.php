<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyQuarryVehiclePreference;
use App\Models\MaterialSpecification;
use App\Models\MaterialType;
use App\Models\Quarry;
use App\Models\VehicleType;

class MasterDataOptionsController extends Controller
{
    public function index()
    {
        $companies = Company::query()
            ->where('status', Company::STATUS_ACTIVE)
            ->orderBy('company_name')
            ->get()
            ->map(fn (Company $c) => [
                'id' => $c->id,
                'company_name' => $c->company_name,
                'client_name' => $c->company_name,
                'company_email' => $c->company_email,
                'email' => $c->company_email,
                'contact_person' => $c->contact_person,
                'contact_number' => $c->contact_number,
                'phone' => $c->contact_number,
            ]);

        $preferences = CompanyQuarryVehiclePreference::query()
            ->where('status', 'active')
            ->where('is_default', true)
            ->with(['company:id,company_name', 'quarry:id,quarry_name', 'vehicleType:id,name,wheel_type,min_cbm,max_cbm'])
            ->get()
            ->map(fn ($p) => array_merge($p->toArray(), [
                'client_id' => $p->company_id,
                'client' => $p->company ? [
                    'id' => $p->company->id,
                    'client_name' => $p->company->company_name,
                ] : null,
            ]));

        return response()->json([
            'companies' => $companies,
            'clients' => $companies,
            'material_types' => MaterialType::query()
                ->where('status', 'active')
                ->with(['specifications' => fn ($q) => $q->where('status', 'active')->orderBy('name')])
                ->orderBy('name')
                ->get(),
            'material_specifications' => MaterialSpecification::query()
                ->where('status', 'active')
                ->orderBy('name')
                ->get(),
            'quarries' => Quarry::query()
                ->where('status', 'active')
                ->orderBy('quarry_name')
                ->get(),
            'vehicle_types' => VehicleType::query()
                ->where('status', 'active')
                ->orderBy('name')
                ->get(),
            'company_preferences' => $preferences,
            'client_preferences' => $preferences,
        ]);
    }
}
