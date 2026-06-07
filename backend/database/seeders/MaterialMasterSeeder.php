<?php

namespace Database\Seeders;

use App\Models\MaterialSpecification;
use App\Models\MaterialType;
use Illuminate\Database\Seeder;

class MaterialMasterSeeder extends Seeder
{
    public function run(): void
    {
        $materials = [
            'Crushed Rocks (Aggregates)' => ['S1', '3/4"', '3/8"', 'G1', 'G2'],
            'Sand' => ['Fine Sand', 'Coarse Sand', 'Washed Sand', 'Filling Sand'],
            'Gravel' => ['3/8" Gravel', '3/4" Gravel', 'Mixed Gravel'],
            'Mixed Aggregates' => ['Screenings', 'Mixed Fill'],
            'Base Materials' => ['Basecourse', 'Subbase'],
            'Soil' => ['Filling Soil', 'Topsoil', 'Clay', 'Embankment Fill'],
            'Cement / Concrete' => ['Portland Cement', 'Ready-Mix Concrete', 'Precast Concrete', 'Concrete Mix (Bagged)'],
            'Steel' => ['10 mm', '12 mm', '16 mm', '20 mm', '25 mm'],
            'Structural Steel' => ['Beams', 'Columns', 'Plates'],
            'Concrete Blocks' => ['4 inches', '6 inches', '8 inches'],
            'Bricks' => ['Standard Bricks', 'Clay Bricks'],
            'Lumber' => ['2x2', '2x4', '2x6'],
            'Formworks' => ['Wooden Formworks', 'Steel Formworks'],
            'Plywood' => ['Ordinary Plywood', 'Marine Plywood'],
            'Pipes' => ['PVC', 'GI', 'HDPE'],
            'Asphalt' => ['Hot Mix Asphalt', 'Cold Mix Asphalt', 'Bitumen'],
            'Boulders' => ['Apple Size', 'Head Size', 'Double Head Size', 'Triple Head Size'],
            'Riprap / Large Stones' => ['Class A (small riprap)', 'Class B (medium riprap)', 'Class C (large riprap)'],
        ];

        foreach ($materials as $typeName => $specifications) {
            $materialType = MaterialType::updateOrCreate(
                ['name' => trim($typeName)],
                ['status' => 'active']
            );

            foreach ($specifications as $specName) {
                MaterialSpecification::updateOrCreate(
                    [
                        'material_type_id' => $materialType->id,
                        'name' => trim($specName),
                    ],
                    ['status' => 'active']
                );
            }
        }
    }
}
