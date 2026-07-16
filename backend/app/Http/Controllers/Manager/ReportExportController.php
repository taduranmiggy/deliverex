<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Services\Reports\ReportExportService;
use Illuminate\Http\Request;

class ReportExportController extends Controller
{
    public function __construct(private ReportExportService $exports)
    {
    }

    public function export(Request $request)
    {
        return $this->exports->export($request);
    }
}
