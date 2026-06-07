<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientQuarryVehiclePreference;
use App\Models\MaterialSpecification;
use App\Models\MaterialType;
use App\Models\Quarry;
use App\Models\VehicleType;

class MasterDataOptionsController extends Controller
{
    public function index()
    {
        return response()->json([
            'clients' => Client::query()
                ->where('status', 'active')
                ->orderBy('client_name')
                ->get(),
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
            'client_preferences' => ClientQuarryVehiclePreference::query()
                ->where('status', 'active')
                ->where('is_default', true)
                ->with(['client:id,client_name', 'quarry:id,quarry_name', 'vehicleType:id,name,wheel_type,min_cbm,max_cbm'])
                ->get(),
        ]);
    }
}
