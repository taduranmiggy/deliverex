<?php

namespace App\Support;

use App\Models\DeliveryCompletionProof;
use App\Models\DeliveryDocument;
use App\Models\DispatchAssignment;
use Illuminate\Support\Facades\Storage;

final class CustomerProofDocuments
{
    /**
     * Customer-facing proof documents for a delivery assignment.
     *
     * @return list<array{
     *     id: int|null,
     *     type: string,
     *     proof_type?: string,
     *     label: string,
     *     url: string,
     *     uploaded_at: string|null,
     *     ocr_ready: bool
     * }>
     */
    public static function forAssignment(?DispatchAssignment $assignment, string $status): array
    {
        if (! $assignment || ! self::isCompletedStatus($status)) {
            return [];
        }

        $documents = [];
        $includedDocIds = [];

        $completionProof = $assignment->completionProof;
        if ($completionProof) {
            $doc = $completionProof->deliveryDocument;
            if ($doc) {
                $documents[] = self::serializeCompletionDocument($completionProof, $doc);
                $includedDocIds[] = $doc->id;
            }

            if ($completionProof->receiver_signature_path) {
                $documents[] = self::serializeSignature($completionProof);
            }
        }

        foreach ($assignment->deliveryDocuments->where('type', 'pod') as $doc) {
            if (! in_array($doc->id, $includedDocIds, true)) {
                $documents[] = self::serializeStandalonePod($doc);
            }
        }

        return $documents;
    }

    private static function isCompletedStatus(string $status): bool
    {
        return strtolower(trim($status)) === DeliveryStatus::COMPLETED;
    }

    /**
     * @return array{
     *     id: int,
     *     type: string,
     *     proof_type: string,
     *     label: string,
     *     url: string,
     *     uploaded_at: string|null,
     *     ocr_ready: bool
     * }
     */
    private static function serializeCompletionDocument(
        DeliveryCompletionProof $completionProof,
        DeliveryDocument $doc,
    ): array {
        return [
            'id'          => $doc->id,
            'type'        => $doc->type,
            'proof_type'  => $completionProof->proof_type,
            'label'       => DeliveryCompletionProof::TYPES[$completionProof->proof_type] ?? $doc->type,
            'url'         => Storage::disk('public')->url($doc->file_path),
            'uploaded_at' => $completionProof->created_at?->toIso8601String(),
            'ocr_ready'   => $doc->ocrResult?->is_validated ?? false,
        ];
    }

    /**
     * @return array{
     *     id: null,
     *     type: string,
     *     proof_type: string,
     *     label: string,
     *     url: string,
     *     uploaded_at: string|null,
     *     ocr_ready: bool
     * }
     */
    private static function serializeSignature(DeliveryCompletionProof $completionProof): array
    {
        return [
            'id'          => null,
            'type'        => 'signature',
            'proof_type'  => 'receiver_signature',
            'label'       => 'Receiver Signature',
            'url'         => Storage::disk('public')->url($completionProof->receiver_signature_path),
            'uploaded_at' => $completionProof->created_at?->toIso8601String(),
            'ocr_ready'   => false,
        ];
    }

    /**
     * @return array{
     *     id: int,
     *     type: string,
     *     label: string,
     *     url: string,
     *     uploaded_at: string|null,
     *     ocr_ready: bool
     * }
     */
    private static function serializeStandalonePod(DeliveryDocument $doc): array
    {
        return [
            'id'          => $doc->id,
            'type'        => $doc->type,
            'label'       => 'Proof of Delivery',
            'url'         => Storage::disk('public')->url($doc->file_path),
            'uploaded_at' => $doc->created_at?->toIso8601String(),
            'ocr_ready'   => $doc->ocrResult?->is_validated ?? false,
        ];
    }
}
