<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $meta->reportTitle }}</title>
    <style>
        @page { margin: 30px 34px 52px; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 9.5px;
            line-height: 1.35;
            color: #172033;
        }
        .report-header {
            border: 1px solid #d7e0ec;
            border-top: 5px solid #1d4ed8;
            border-radius: 6px;
            padding: 15px 17px 13px;
            margin-bottom: 14px;
            background: #ffffff;
        }
        .brand-table, .meta-table, .footer-table { width: 100%; border-collapse: collapse; }
        .brand-table td, .meta-table td, .footer-table td { border: 0; padding: 0; }
        .brand-cell { width: 54%; vertical-align: middle; }
        .title-cell { width: 46%; vertical-align: middle; text-align: right; }
        .logo {
            width: 46px;
            height: 46px;
            vertical-align: middle;
            margin-right: 10px;
        }
        .logo-fallback {
            display: inline-block;
            width: 46px;
            height: 46px;
            line-height: 46px;
            text-align: center;
            border-radius: 8px;
            background: #1d4ed8;
            color: #ffffff;
            font-size: 16px;
            font-weight: 700;
            margin-right: 10px;
            vertical-align: middle;
        }
        .brand-copy { display: inline-block; vertical-align: middle; }
        .system-name { margin: 0; color: #0f172a; font-size: 18px; line-height: 1.1; font-weight: 700; }
        .company-name { margin: 4px 0 0; color: #526078; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
        .report-kicker { margin: 0 0 4px; color: #1d4ed8; font-size: 8px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
        .report-title { margin: 0; color: #172033; font-size: 16px; line-height: 1.2; font-weight: 700; }
        .document-id { margin: 5px 0 0; color: #718096; font-size: 8px; }
        .divider { height: 1px; margin: 13px 0 10px; background: #dce4ef; }
        .meta-table td { width: 50%; vertical-align: top; color: #40506a; line-height: 1.65; }
        .meta-table td:last-child { padding-left: 24px; }
        .meta-label { display: inline-block; min-width: 83px; color: #718096; font-size: 8.2px; font-weight: 700; text-transform: uppercase; }
        .meta-value { color: #172033; font-weight: 600; }
        .filters {
            margin-top: 10px;
            padding: 8px 10px;
            border-left: 3px solid #1d4ed8;
            background: #f4f7fb;
            color: #40506a;
        }
        .filters-title { margin-right: 7px; color: #172033; font-size: 8.3px; font-weight: 700; text-transform: uppercase; }
        .summary { margin-top: 8px; color: #40506a; font-size: 8.7px; }
        .summary-item { display: inline-block; margin-right: 16px; }
        .summary-key { color: #718096; text-transform: uppercase; font-size: 7.8px; font-weight: 700; }
        table.data { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; }
        table.data thead { display: table-header-group; }
        table.data tr { page-break-inside: avoid; }
        table.data th {
            padding: 7px 6px;
            border: 1px solid #c7d2e1;
            background: #eaf0f8;
            color: #24324a;
            font-size: 8px;
            line-height: 1.2;
            font-weight: 700;
            text-align: left;
            text-transform: uppercase;
            letter-spacing: .025em;
        }
        table.data td {
            padding: 6px;
            border: 1px solid #dce4ef;
            vertical-align: top;
            color: #26354d;
            font-size: 8.2px;
            overflow-wrap: anywhere;
        }
        table.data tbody tr:nth-child(even) td { background: #f8fafc; }
        body.compact table.data th { padding: 6px 4px; font-size: 7.1px; }
        body.compact table.data td { padding: 5px 4px; font-size: 7.25px; }
        .empty { padding: 20px !important; text-align: center; color: #718096 !important; }
        .footer {
            position: fixed;
            right: 0;
            bottom: -34px;
            left: 0;
            padding-top: 7px;
            border-top: 1px solid #cbd5e1;
            color: #64748b;
            font-size: 7.4px;
        }
        .footer-left { width: 75%; text-align: left; }
        .footer-right { width: 25%; text-align: right; padding-right: 94px !important; color: #1d4ed8; font-weight: 700; }
        .watermark {
            position: fixed;
            top: 42%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-28deg);
            font-size: 54px;
            color: rgba(29, 78, 216, 0.06);
            font-weight: 700;
            letter-spacing: 0.08em;
            z-index: 0;
        }
        .signature-block {
            margin-top: 18px;
            padding: 12px 14px;
            border: 1px dashed #cbd5e1;
            border-radius: 6px;
            color: #64748b;
            font-size: 8px;
        }
        .signature-line {
            margin-top: 28px;
            border-top: 1px solid #94a3b8;
            width: 220px;
            padding-top: 6px;
            color: #475569;
            font-size: 8px;
        }
    </style>
</head>
<body class="{{ ($columnCount ?? count($headers)) >= 9 ? 'compact' : '' }}">
    @if (!empty($showWatermark))
        <div class="watermark">CONFIDENTIAL</div>
    @endif
    <div class="footer">
        <table class="footer-table">
            <tr>
                <td class="footer-left">{{ $footerText }} | {{ $productName }} Enterprise Reporting</td>
                <td class="footer-right"></td>
            </tr>
        </table>
    </div>

    <div class="report-header">
        <table class="brand-table">
            <tr>
                <td class="brand-cell">
                    @if (!empty($logoDataUri))
                        <img class="logo" src="{{ $logoDataUri }}" alt="Deliverex logo">
                    @else
                        <span class="logo-fallback">DX</span>
                    @endif
                    <div class="brand-copy">
                        <p class="system-name">{{ $productName }}</p>
                        @if (!empty($showCompany))
                            <p class="company-name">{{ $companyName }}</p>
                        @endif
                    </div>
                </td>
                <td class="title-cell">
                    <p class="report-kicker">Deliverex Enterprise Report</p>
                    <h1 class="report-title">{{ $meta->reportTitle }}</h1>
                    <p class="document-id">Version {{ $documentVersion ?? '1.0' }}@if(!empty($jobOrderId)) | Job Order #{{ $jobOrderId }}@endif</p>
                </td>
            </tr>
        </table>

        <div class="divider"></div>

        <table class="meta-table">
            <tr>
                <td>
                    @if (!empty($showGeneratedBy))
                        <span class="meta-label">Generated By</span>
                        <span class="meta-value">{{ $meta->generatedByName() }}</span><br>
                        <span class="meta-label">User Role</span>
                        <span class="meta-value">{{ $meta->generatedByRole() }}</span>
                    @endif
                </td>
                <td>
                    @if (!empty($showTimestamp))
                        <span class="meta-label">Generated On</span>
                        <span class="meta-value">{{ $meta->generatedDateLabel() }}</span><br>
                        <span class="meta-label">Time</span>
                        <span class="meta-value">{{ $meta->generatedTimeLabel() }}</span><br>
                    @endif
                    <span class="meta-label">Date Range</span>
                    <span class="meta-value">{{ $meta->dateRangeLabel() }}</span>
                </td>
            </tr>
        </table>

        @if (!empty($showFiltersSummary))
            <div class="filters">
                <span class="filters-title">Filters Used</span>
                {{ implode(' | ', $meta->filterLines()) }}
            </div>
        @endif

        @if (!empty($meta->summary))
            <div class="summary">
                @foreach ($meta->summary as $key => $value)
                    @if ($value !== null && $value !== '')
                        <span class="summary-item"><span class="summary-key">{{ ucwords(str_replace('_', ' ', $key)) }}</span> {{ $value }}</span>
                    @endif
                @endforeach
            </div>
        @endif
    </div>

    <table class="data">
        <thead>
            <tr>
                @foreach ($headers as $header)
                    <th>{{ $header }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse ($rows as $row)
                <tr>
                    @foreach ($row as $cell)
                        <td>{{ $cell ?? '-' }}</td>
                    @endforeach
                </tr>
            @empty
                <tr>
                    <td class="empty" colspan="{{ count($headers) }}">No records found for the selected filters.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    @if (!empty($showSignature))
        <div class="signature-block">
            <strong>Authorized Signature</strong>
            <div class="signature-line">Name / Title / Date</div>
        </div>
    @endif

</body>
</html>
