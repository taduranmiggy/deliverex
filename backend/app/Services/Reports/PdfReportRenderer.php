<?php

namespace App\Services\Reports;

use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Facades\View;

class PdfReportRenderer
{
    /**
     * @param  list<string>  $headers
     * @param  list<list<string|int|float|null>>  $rows
     */
    public function render(ReportMetadata $meta, array $headers, array $rows, string $filename): \Symfony\Component\HttpFoundation\Response
    {
        $orientation = $meta->orientation(count($headers));
        $html = View::make('reports.table', [
            'meta' => $meta,
            'headers' => $headers,
            'rows' => $rows,
            'companyName' => config('reports.company_name'),
            'productName' => config('reports.product_name'),
            'footerText' => config('reports.footer_text'),
            'exportedBy' => $meta->generatedByLabel(),
            'documentVersion' => config('reports.document_version', '1.0'),
            'jobOrderId' => $meta->summary['job_order_id'] ?? null,
            'logoDataUri' => $this->logoDataUri(),
            'orientation' => $orientation,
            'columnCount' => count($headers),
        ])->render();

        $options = new Options;
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', $orientation);
        $dompdf->render();

        $canvas = $dompdf->getCanvas();
        $font = $dompdf->getFontMetrics()->getFont('DejaVu Sans', 'normal');
        $canvas->page_text(
            $canvas->get_width() - 116,
            $canvas->get_height() - 28,
            'Page {PAGE_NUM} of {PAGE_COUNT}',
            $font,
            8,
            [0.28, 0.35, 0.45],
        );

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    private function logoDataUri(): ?string
    {
        $candidates = [
            dirname(base_path()).DIRECTORY_SEPARATOR.'frontend'.DIRECTORY_SEPARATOR.'public'.DIRECTORY_SEPARATOR.'favicon-192x192.png',
            dirname(base_path()).DIRECTORY_SEPARATOR.'frontend'.DIRECTORY_SEPARATOR.'public'.DIRECTORY_SEPARATOR.'deliverexx.png',
            public_path('favicon.svg'),
        ];

        foreach ($candidates as $path) {
            if (! is_file($path) || ! is_readable($path)) {
                continue;
            }

            $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            $mime = $extension === 'svg' ? 'image/svg+xml' : 'image/png';

            return 'data:'.$mime.';base64,'.base64_encode((string) file_get_contents($path));
        }

        return null;
    }
}
