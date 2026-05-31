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
        $disk = Storage::disk('public');

        if (! $document->file_path || ! $disk->exists($document->file_path)) {
            abort(404, 'Document file not found. Run: php artisan storage:link && confirm the file exists in storage/app/public/'.$document->file_path);
        }

        $mime = $disk->mimeType($document->file_path) ?: 'application/octet-stream';
        $name = basename($document->file_path);

        return $disk->response($document->file_path, $name, [
            'Content-Type'  => $mime,
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }
}
