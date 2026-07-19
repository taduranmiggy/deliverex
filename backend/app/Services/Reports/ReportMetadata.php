<?php

namespace App\Services\Reports;

use App\Models\User;
use Illuminate\Http\Request;

final class ReportMetadata
{
    /**
     * @param  array<string, string|null>  $filters
     * @param  array<string, int|float|string|null>  $summary
     * @param  array<string, bool>  $exportOptions
     */
    public function __construct(
        public readonly string $reportType,
        public readonly string $reportTitle,
        public readonly array $filters,
        public readonly ?User $generatedBy,
        public readonly array $summary = [],
        public readonly array $exportOptions = [],
    ) {
    }

    public static function fromRequest(
        Request $request,
        string $reportType,
        string $reportTitle,
        array $filters,
        array $summary = [],
        array $exportOptions = [],
    ): self {
        return new self(
            reportType: $reportType,
            reportTitle: $reportTitle,
            filters: $filters,
            generatedBy: $request->user(),
            summary: $summary,
            exportOptions: $exportOptions,
        );
    }

    public function exportOption(string $key, bool $default = true): bool
    {
        return (bool) ($this->exportOptions[$key] ?? $default);
    }

    /** @return list<string> */
    public function filterLines(): array
    {
        $lines = [];
        foreach ($this->filters as $key => $value) {
            if ($value === null || $value === '' || in_array($key, [
                'from', 'to', 'date_from', 'date_to', 'date_preset', 'all_records',
            ], true)) {
                continue;
            }
            $label = ucwords(str_replace('_', ' ', (string) $key));
            $displayValue = is_bool($value) ? ($value ? 'Yes' : 'No') : (is_scalar($value) ? (string) $value : json_encode($value));
            $lines[] = "{$label}: {$displayValue}";
        }

        return $lines ?: ['None'];
    }

    public function generatedAtLabel(): string
    {
        return now()->timezone(config('reports.default_timezone'))->format('F j, Y g:i A');
    }

    public function generatedDateLabel(): string
    {
        return now()->timezone(config('reports.default_timezone'))->format('F j, Y');
    }

    public function generatedTimeLabel(): string
    {
        return now()->timezone(config('reports.default_timezone'))->format('g:i A');
    }

    public function generatedByName(): string
    {
        return $this->generatedBy?->name ?? 'System';
    }

    public function generatedByRole(): string
    {
        if (! $this->generatedBy) {
            return 'System';
        }

        $role = $this->generatedBy->relationLoaded('role')
            ? $this->generatedBy->role?->name
            : $this->generatedBy->loadMissing('role')->role?->name;

        return ucwords(str_replace('_', ' ', $role ?? 'User'));
    }

    public function dateRangeLabel(): string
    {
        if (($this->filters['all_records'] ?? null) === true || ($this->filters['all_records'] ?? null) === 'yes') {
            return 'All records';
        }

        $from = $this->filters['from'] ?? $this->filters['date_from'] ?? null;
        $to = $this->filters['to'] ?? $this->filters['date_to'] ?? null;

        return ExportDateRange::label(
            is_scalar($from) ? (string) $from : null,
            is_scalar($to) ? (string) $to : null,
        );
    }

    public function orientation(int $columnCount): string
    {
        $configured = config("reports.{$this->reportType}.orientation");
        if (in_array($configured, ['portrait', 'landscape'], true)) {
            return $configured;
        }

        return $columnCount >= 6 ? 'landscape' : 'portrait';
    }

    public function generatedByLabel(): string
    {
        if (! $this->generatedBy) {
            return 'System';
        }

        return trim($this->generatedByName().' ('.$this->generatedByRole().')');
    }

    public function fileSlug(): string
    {
        return str_replace('_', '-', $this->reportType).'_'.now()->format('Y_m_d_His');
    }
}
