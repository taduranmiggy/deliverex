<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OcrResult;
use Illuminate\Http\Request;

class OcrReviewController extends Controller
{
    public function index()
    {
        return response()->json(
            OcrResult::with('document', 'document.assignment.jobOrder')
                ->where('is_validated', false)
                ->paginate(20)
        );
    }

    public function validateResult(Request $request, OcrResult $ocrResult)
    {
        $data = $request->validate([
            'corrected_text' => 'nullable|string',
            'confidence_score' => 'nullable|numeric',
        ]);

        $ocrResult->update([
            'corrected_text' => $data['corrected_text'] ?? $ocrResult->corrected_text,
            'confidence_score' => $data['confidence_score'] ?? $ocrResult->confidence_score,
            'is_validated' => true,
            'validated_by' => $request->user()?->id,
        ]);

        return response()->json($ocrResult->load('document'));
    }
}
