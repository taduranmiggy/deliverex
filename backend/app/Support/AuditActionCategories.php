<?php

namespace App\Support;

class AuditActionCategories
{
    /** @return list<string> */
    public static function patterns(string $category): array
    {
        return match ($category) {
            'created' => ['created', 'invite_sent', 'imported'],
            'updated' => ['updated', 'changed', 'reconciled', 'acknowledged', 'marked_read', 'retried'],
            'deleted' => ['deleted'],
            'assigned' => ['assigned'],
            'completed' => ['completed'],
            'login' => ['login'],
            'logout' => ['logout'],
            'exported' => ['export', 'exported'],
            'imported' => ['import', 'imported'],
            'failed_login' => ['login_failed'],
            'password_reset' => ['password_reset', 'password_reset_requested', 'password_changed'],
            default => [$category],
        };
    }

    /** @param  list<string>  $categories */
    public static function applyToQuery($query, array $categories): void
    {
        if ($categories === []) {
            return;
        }

        $query->where(function ($builder) use ($categories) {
            foreach ($categories as $category) {
                foreach (self::patterns($category) as $pattern) {
                    $builder->orWhere('action', 'like', '%'.$pattern.'%');
                }
            }
        });
    }
}
