<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Services\MasterData\MaterialMasterDataService;
use Illuminate\Http\Request;

class MaterialMasterDataController extends Controller
{
    public function __construct(private MaterialMasterDataService $materialMasterData)
    {
    }

    public function storeMaterialType(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
        ]);

        ['model' => $type, 'created' => $created] = $this->materialMasterData->findOrCreateMaterialType($data['name']);

        return response()->json([
            'material_type' => $type->load(['specifications' => fn ($q) => $q->where('status', 'active')->orderBy('name')]),
            'created'       => $created,
            'message'       => $created ? 'Material type saved to Master Data.' : 'Existing material type selected.',
        ], $created ? 201 : 200);
    }

    public function storeMaterialSpecification(Request $request)
    {
        $data = $request->validate([
            'material_type_id' => 'required|exists:material_types,id',
            'name'             => 'required|string|max:160',
        ]);

        ['model' => $spec, 'created' => $created] = $this->materialMasterData->findOrCreateSpecification(
            (int) $data['material_type_id'],
            $data['name'],
        );

        return response()->json([
            'material_specification' => $spec->load('materialType:id,name'),
            'created'                => $created,
            'message'                => $created ? 'Specification saved to Master Data.' : 'Existing specification selected.',
        ], $created ? 201 : 200);
    }
}
