<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$img = storage_path('app/public/delivery_documents/test_ocr.png');
if (! is_dir(dirname($img))) {
    mkdir(dirname($img), 0755, true);
}
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
file_put_contents($img, $png);

$assignmentId = App\Models\DispatchAssignment::query()->value('id') ?? 1;
$doc = App\Models\DeliveryDocument::create([
    'assignment_id' => $assignmentId,
    'file_path'     => 'delivery_documents/test_ocr.png',
    'type'          => 'receipt',
    'uploaded_by'   => 1,
]);

$svc = app(App\Services\Ocr\OcrService::class);
$svc->createPending($doc);
$result = $svc->process($doc->fresh());

echo json_encode([
    'document_id' => $doc->id,
    'status'      => $result->processing_status,
    'engine'      => $result->engine,
    'error'       => $result->error_message,
    'text'        => $result->extracted_text,
    'file_exists' => Illuminate\Support\Facades\Storage::disk('public')->exists($doc->file_path),
], JSON_PRETTY_PRINT).PHP_EOL;
