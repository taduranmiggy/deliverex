<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DeliveryDocument;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentFileController extends Controller
{
    public function show(DeliveryDocument $document): StreamedResponse
    {
        if (! Storage::disk('public')->exists($document->file_path)) {
            abort(404, 'Document file not found. Run php artisan storage:link if this is a new environment.');
        }

        return Storage::disk('public')->response($document->file_path);
    }
}
