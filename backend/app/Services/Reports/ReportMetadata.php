<?php

namespace App\Services\Reports;

use App\Models\User;
use Illuminate\Http\Request;

final class ReportMetadata
{
    /**
     * @param  array<string, string|null>  $filters
     * @param  array<string, int|float|string|null>  $summary
     */
    public function __construct(
        public readonly string $reportType,
        public readonly string $reportTitle,
        public readonly array $filters,
        public readonly ?User $generatedBy,
        public readonly array $summary = [],
    ) {
    }

    public static function fromRequest(
        Request $request,
        string $reportType,
        string $reportTitle,
        array $filters,
        array $summary = [],
    ): self {
        return new self(
            reportType: $reportType,
            reportTitle: $reportTitle,
            filters: $filters,
            generatedBy: $request->user(),
            summary: $summary,
        );
    }

    /** @return list<string> */
    public function filterLines(): array
    {
        $lines = [];
        foreach ($this->filters as $key => $value) {
            if ($value === null || $value === '') {
                continue;
            }
            $label = ucwords(str_replace('_', ' ', (string) $key));
            $lines[] = "{$label}: {$value}";
        }

        return $lines ?: ['None'];
    }

    public function generatedAtLabel(): string
    {
        return now()->timezone(config('reports.default_timezone'))->format('M j, Y g:i A T');
    }

    public function generatedByLabel(): string
    {
        if (! $this->generatedBy) {
            return 'System';
        }

        $role = $this->generatedBy->relationLoaded('role')
            ? $this->generatedBy->role?->name
            : $this->generatedBy->loadMissing('role')->role?->name;

        return trim($this->generatedBy->name.' ('.($role ?? 'user').')');
    }

    public function fileSlug(): string
    {
        return str_replace('_', '-', $this->reportType).'_'.now()->format('Y_m_d_His');
    }
}
