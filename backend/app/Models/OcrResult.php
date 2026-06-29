<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OcrResult extends Model
{
    /** @var array<string, string> */
    public const STRUCTURED_FIELD_COLUMNS = [
        'length' => 'extracted_length',
        'width' => 'extracted_width',
        'height' => 'extracted_height',
        'volume' => 'extracted_volume',
        'delivery_receipt_number' => 'delivery_receipt_number',
    ];

    /** @var list<string> */
    public const AUXILIARY_FIELDS = [
        'supplier',
        'date',
        'quantity',
        'total',
    ];

    /** @var list<string> */
    public const CORRECTABLE_FIELDS = [
        'length',
        'width',
        'height',
        'volume',
        'delivery_receipt_number',
        'supplier',
        'date',
        'quantity',
        'total',
    ];

    protected $fillable = [
        'document_id',
        'processing_status',
        'review_status',
        'extracted_text',
        'corrected_text',
        'extracted_length',
        'extracted_width',
        'extracted_height',
        'extracted_volume',
        'delivery_receipt_number',
        'assignment_id',
        'job_order_id',
        'driver_id',
        'driver_name',
        'vehicle_plate_no',
        'delivery_date',
        'confidence_score',
        'engine',
        'ocr_diagnostics',
        'field_corrections',
        'error_message',
        'review_notes',
        'reviewed_at',
        'is_validated',
        'validated_by',
    ];

    protected $casts = [
        'is_validated' => 'boolean',
        'reviewed_at' => 'datetime',
        'delivery_date' => 'datetime',
        'extracted_length' => 'float',
        'extracted_width' => 'float',
        'extracted_height' => 'float',
        'extracted_volume' => 'float',
        'ocr_diagnostics' => 'array',
        'field_corrections' => 'array',
    ];

    public function document()
    {
        return $this->belongsTo(DeliveryDocument::class, 'document_id');
    }

    public function validator()
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function assignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'assignment_id');
    }

    public function jobOrder()
    {
        return $this->belongsTo(JobOrder::class, 'job_order_id');
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }

    /**
     * @return array<string, mixed>
     */
    public function correctionsMap(): array
    {
        return is_array($this->field_corrections) ? $this->field_corrections : [];
    }

    public function getOriginalValue(string $field): mixed
    {
        $corrections = $this->correctionsMap();
        if (isset($corrections[$field]['original'])) {
            return $corrections[$field]['original'];
        }

        if (isset(self::STRUCTURED_FIELD_COLUMNS[$field])) {
            return $this->{self::STRUCTURED_FIELD_COLUMNS[$field]};
        }

        return $this->auxiliarySuggestionValue($field);
    }

    public function getEffectiveValue(string $field): mixed
    {
        $corrections = $this->correctionsMap();
        if (array_key_exists('corrected', $corrections[$field] ?? [])) {
            return $corrections[$field]['corrected'];
        }

        if (isset(self::STRUCTURED_FIELD_COLUMNS[$field])) {
            return $this->{self::STRUCTURED_FIELD_COLUMNS[$field]};
        }

        return $this->auxiliarySuggestionValue($field);
    }

    /**
     * @return array<string, mixed>
     */
    public function buildEffectiveValues(): array
    {
        $values = [];
        foreach (self::CORRECTABLE_FIELDS as $field) {
            $values[$field] = $this->getEffectiveValue($field);
        }

        return $values;
    }

    /**
     * Commit effective structured values for export/validation after admin approval.
     */
    public function applyEffectiveStructuredFieldsToRecord(): void
    {
        foreach (self::STRUCTURED_FIELD_COLUMNS as $field => $column) {
            $effective = $this->getEffectiveValue($field);
            if ($effective === null || $effective === '') {
                continue;
            }

            if (in_array($field, ['length', 'width', 'height', 'volume'], true)) {
                $this->{$column} = is_numeric($effective) ? (float) $effective : $effective;
            } else {
                $this->{$column} = (string) $effective;
            }
        }
    }

    private function auxiliarySuggestionValue(string $field): mixed
    {
        $suggestions = $this->ocr_diagnostics['review_suggestions'][$field] ?? [];
        if (! is_array($suggestions) || $suggestions === []) {
            return null;
        }

        $top = $suggestions[0]['value'] ?? null;

        return $top === null || $top === '' ? null : $top;
    }
}
