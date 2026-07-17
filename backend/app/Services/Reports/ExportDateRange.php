<?php

namespace App\Services\Reports;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ExportDateRange
{
    /** @return array{from: ?string, to: ?string, all_records: bool, label: string, preset: ?string} */
    public static function resolveOptional(Request $request): array
    {
        $allRecords = filter_var($request->query('all_records', false), FILTER_VALIDATE_BOOLEAN);

        if ($allRecords) {
            return [
                'from' => null,
                'to' => null,
                'all_records' => true,
                'label' => 'All records',
                'preset' => 'all',
            ];
        }

        $preset = $request->query('date_preset');
        $from = $request->query('from') ?: $request->query('date_from');
        $to = $request->query('to') ?: $request->query('date_to');

        if ($preset && $preset !== 'custom' && $preset !== 'all') {
            [$from, $to] = self::presetRange($preset);
        }

        return [
            'from' => $from ? (string) $from : null,
            'to' => $to ? (string) $to : null,
            'all_records' => false,
            'label' => self::label($from, $to),
            'preset' => $preset ? (string) $preset : ($from || $to ? 'custom' : null),
        ];
    }

    /** @return array{from: ?string, to: ?string, all_records: bool, label: string, preset: ?string} */
    public static function resolve(Request $request, int $defaultDays = 30): array
    {
        $allRecords = filter_var($request->query('all_records', false), FILTER_VALIDATE_BOOLEAN);

        if ($allRecords) {
            return [
                'from' => null,
                'to' => null,
                'all_records' => true,
                'label' => 'All records',
                'preset' => 'all',
            ];
        }

        $preset = $request->query('date_preset');
        $from = $request->query('from') ?: $request->query('date_from');
        $to = $request->query('to') ?: $request->query('date_to');

        if ($preset && $preset !== 'custom' && $preset !== 'all') {
            [$from, $to] = self::presetRange($preset);
        }

        if (! $from && ! $to) {
            $from = now()->subDays(max(1, $defaultDays) - 1)->toDateString();
            $to = now()->toDateString();
        }

        return [
            'from' => $from ? (string) $from : null,
            'to' => $to ? (string) $to : null,
            'all_records' => false,
            'label' => self::label($from, $to),
            'preset' => $preset ? (string) $preset : 'custom',
        ];
    }

    /** @return array{0: string, 1: string} */
    public static function presetRange(string $preset): array
    {
        $today = now()->startOfDay();

        return match ($preset) {
            'today' => [$today->toDateString(), $today->toDateString()],
            'yesterday' => [
                $today->copy()->subDay()->toDateString(),
                $today->copy()->subDay()->toDateString(),
            ],
            'last_7_days' => [
                $today->copy()->subDays(6)->toDateString(),
                $today->toDateString(),
            ],
            'last_30_days' => [
                $today->copy()->subDays(29)->toDateString(),
                $today->toDateString(),
            ],
            'this_month' => [
                $today->copy()->startOfMonth()->toDateString(),
                $today->toDateString(),
            ],
            'last_month' => [
                $today->copy()->subMonth()->startOfMonth()->toDateString(),
                $today->copy()->subMonth()->endOfMonth()->toDateString(),
            ],
            default => [
                $today->copy()->subDays(29)->toDateString(),
                $today->toDateString(),
            ],
        };
    }

    public static function label(?string $from, ?string $to): string
    {
        if ($from && $to) {
            return $from === $to ? $from : "{$from} – {$to}";
        }
        if ($from) {
            return "From {$from}";
        }
        if ($to) {
            return "Until {$to}";
        }

        return 'All records';
    }

    public static function applyToQuery($query, string $column, ?string $from, ?string $to, bool $dateOnly = false): void
    {
        if (! $from && ! $to) {
            return;
        }

        try {
            if ($from) {
                if ($dateOnly) {
                    $query->whereDate($column, '>=', $from);
                } else {
                    $query->where($column, '>=', Carbon::parse($from)->startOfDay());
                }
            }
            if ($to) {
                if ($dateOnly) {
                    $query->whereDate($column, '<=', $to);
                } else {
                    $query->where($column, '<=', Carbon::parse($to)->endOfDay());
                }
            }
        } catch (\Throwable) {
            abort(422, 'Invalid date range.');
        }
    }

    /** Merge resolved range back into request for downstream query builders. */
    public static function mergeIntoRequest(Request $request, array $range): Request
    {
        $merged = $request->query();
        if ($range['all_records']) {
            $merged['all_records'] = '1';
            unset($merged['from'], $merged['to'], $merged['date_from'], $merged['date_to']);
        } else {
            $merged['from'] = $range['from'];
            $merged['to'] = $range['to'];
            $merged['date_from'] = $range['from'];
            $merged['date_to'] = $range['to'];
            unset($merged['all_records']);
        }
        if (! empty($range['preset'])) {
            $merged['date_preset'] = $range['preset'];
        }

        return $request->duplicate(query: $merged);
    }
}
