<?php

namespace App\Services\MasterData;

use App\Models\MaterialSpecification;
use App\Models\MaterialType;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MaterialMasterDataService
{
    public function findOrCreateMaterialType(string $name): array
    {
        $normalized = $this->normalizeName($name);
        if ($normalized === '') {
            throw ValidationException::withMessages([
                'custom_material_type_name' => ['Material type name is required.'],
            ]);
        }

        $existing = MaterialType::query()
            ->whereRaw('LOWER(TRIM(name)) = ?', [Str::lower($normalized)])
            ->first();

        if ($existing) {
            if ($existing->status !== 'active') {
                $existing->update(['status' => 'active']);
            }

            return ['model' => $existing->fresh(), 'created' => false];
        }

        $model = MaterialType::query()->create([
            'name'   => $normalized,
            'status' => 'active',
        ]);

        return ['model' => $model, 'created' => true];
    }

    public function findOrCreateSpecification(int $materialTypeId, string $name): array
    {
        $normalized = $this->normalizeName($name);
        if ($normalized === '') {
            throw ValidationException::withMessages([
                'custom_specification_name' => ['Specification name is required.'],
            ]);
        }

        MaterialType::query()->findOrFail($materialTypeId);

        $existing = MaterialSpecification::query()
            ->where('material_type_id', $materialTypeId)
            ->whereRaw('LOWER(TRIM(name)) = ?', [Str::lower($normalized)])
            ->first();

        if ($existing) {
            if ($existing->status !== 'active') {
                $existing->update(['status' => 'active']);
            }

            return ['model' => $existing->fresh(), 'created' => false];
        }

        $model = MaterialSpecification::query()->create([
            'material_type_id' => $materialTypeId,
            'name'               => $normalized,
            'status'             => 'active',
        ]);

        return ['model' => $model, 'created' => true];
    }

    /**
     * @return array<string, mixed>
     */
    public function resolveJobOrderMaterials(array $data): array
    {
        $customType = trim((string) ($data['custom_material_type_name'] ?? ''));
        $customSpec = trim((string) ($data['custom_specification_name'] ?? ''));

        if (empty($data['material_type_id']) && $customType === '') {
            throw ValidationException::withMessages([
                'material_type_id' => ['Select a material type or enter a custom material name.'],
            ]);
        }

        if ($customType !== '') {
            ['model' => $type] = $this->findOrCreateMaterialType($customType);
            $data['material_type_id'] = $type->id;
        }

        if (empty($data['material_specification_id']) && $customSpec === '') {
            throw ValidationException::withMessages([
                'material_specification_id' => ['Select a specification or enter a custom specification name.'],
            ]);
        }

        if ($customSpec !== '') {
            if (empty($data['material_type_id'])) {
                throw ValidationException::withMessages([
                    'material_type_id' => ['Select a material type before adding a custom specification.'],
                ]);
            }
            ['model' => $spec] = $this->findOrCreateSpecification((int) $data['material_type_id'], $customSpec);
            $data['material_specification_id'] = $spec->id;
        }

        unset($data['custom_material_type_name'], $data['custom_specification_name']);

        $materialType = MaterialType::query()->findOrFail($data['material_type_id']);
        $materialSpec = MaterialSpecification::query()->findOrFail($data['material_specification_id']);

        if ((int) $materialSpec->material_type_id !== (int) $materialType->id) {
            throw ValidationException::withMessages([
                'material_specification_id' => ['Specification does not belong to the selected material type.'],
            ]);
        }

        $data['material_type']      = $materialType->name;
        $data['specification_size'] = $materialSpec->name;

        return $data;
    }

    private function normalizeName(string $name): string
    {
        return preg_replace('/\s+/u', ' ', trim($name)) ?? trim($name);
    }
}
