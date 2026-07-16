<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;

final class AuditChangeTracker
{
    /** @param  array<string>  $fields */
    public static function fromModel(Model $model, array $fields): array
    {
        $changes = [];

        foreach ($fields as $field) {
            if (! $model->wasChanged($field)) {
                continue;
            }

            $changes[$field] = [
                'old' => $model->getOriginal($field),
                'new' => $model->getAttribute($field),
            ];
        }

        return self::redact($changes);
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @param  array<string>  $fields
     * @return array<string, array{old: mixed, new: mixed}>
     */
    public static function diffArrays(array $before, array $after, array $fields): array
    {
        $changes = [];

        foreach ($fields as $field) {
            $old = $before[$field] ?? null;
            $new = $after[$field] ?? null;

            if (self::normalizeValue($old) === self::normalizeValue($new)) {
                continue;
            }

            $changes[$field] = ['old' => $old, 'new' => $new];
        }

        return self::redact($changes);
    }

    /** @param  array<string, array{old: mixed, new: mixed}>  $changes */
    public static function redact(array $changes): array
    {
        $sensitive = config('audit.redact_fields', []);

        foreach ($changes as $field => $value) {
            if (in_array($field, $sensitive, true)) {
                $changes[$field] = ['old' => '[redacted]', 'new' => '[redacted]'];
            }
        }

        return $changes;
    }

    private static function normalizeValue(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        return (string) $value;
    }
}
