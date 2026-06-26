<?php

namespace App\Services\Email;

use Illuminate\Database\Eloquent\Model;

class MailViewData
{
    /** @param  array<string, mixed>  $data */
    public static function normalize(array $data): array
    {
        $normalized = [];

        foreach ($data as $key => $value) {
            if ($value instanceof Model) {
                $normalized[$key] = $value->toArray();
            } elseif (is_array($value)) {
                $normalized[$key] = self::normalize($value);
            } else {
                $normalized[$key] = $value;
            }
        }

        return $normalized;
    }

    /**
     * Convert stored arrays back to objects so Blade can use $company->name syntax.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function prepareForRender(array $data): array
    {
        $prepared = [];

        foreach ($data as $key => $value) {
            if (is_array($value) && self::isAssociativeArray($value)) {
                $prepared[$key] = (object) self::prepareForRender($value);
            } else {
                $prepared[$key] = $value;
            }
        }

        return $prepared;
    }

    /** @param  array<mixed>  $value */
    private static function isAssociativeArray(array $value): bool
    {
        return $value !== [] && array_keys($value) !== range(0, count($value) - 1);
    }
}
