<?php

namespace App\Http\Requests\Driver;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\File;

/**
 * Validation for a driver delivery-document (OCR) upload.
 *
 * Rules and messages are an exact extraction of what previously lived inline in
 * DocumentController@store. No rule, message, key, or payload shape changed —
 * route-level role/auth middleware and the per-assignment ownership check in the
 * controller remain the source of truth for authorization.
 */
class StoreDeliveryDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Authorization is enforced by route middleware (role:driver) and the
        // assignment-ownership check inside the controller. Keep this open so the
        // existing behavior is preserved exactly.
        return true;
    }

    public function rules(): array
    {
        return [
            'assignment_id' => 'required|exists:dispatch_assignments,id',
            'type'          => 'nullable|in:pod,receipt,gate_pass,weighbridge,signed_doc,invoice,job_order,departure,other',
            'notes'         => 'nullable|string|max:2000',
            'file'             => [
                'required',
                File::types(['jpg', 'jpeg', 'png'])
                    ->max(10240),
            ],
            'action_timestamp' => 'nullable|date',
            'action_taken_at'  => 'nullable|date',
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'Please select an image to upload.',
            'file.max'      => 'Image must be under 10 MB.',
            'file.mimes'    => 'Only JPG, JPEG, and PNG images are supported for OCR.',
        ];
    }
}
