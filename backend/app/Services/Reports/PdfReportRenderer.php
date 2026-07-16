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
        ])->render();

        $options = new Options;
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'landscape');
        $dompdf->render();

        $canvas = $dompdf->getCanvas();
        $font = $dompdf->getFontMetrics()->getFont('DejaVu Sans', 'normal');
        $canvas->page_text(40, 560, $meta->generatedByLabel().' · '.$meta->generatedAtLabel(), $font, 7.5, [0.45, 0.45, 0.45]);
        $canvas->page_text(520, 560, 'Page {PAGE_NUM} of {PAGE_COUNT}', $font, 8, [0.4, 0.4, 0.4]);

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }
}
