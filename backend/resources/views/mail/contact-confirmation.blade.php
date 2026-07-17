@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;color:#0f172a;">We received your concern</h1>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Hello {{ $name }},</p>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Thank you for contacting Deliverex. Your concern <strong>{{ $reference_no }}</strong> has been received and our support team will respond via email.</p>

<div style="margin:0 0 14px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:0.875rem;color:#334155;">
    <strong>Ticket ID:</strong> {{ $reference_no }}<br>
    <strong>Category:</strong> {{ $inquiry_type_label ?? $inquiry_type }}<br>
    <strong>Subject:</strong> {{ $subject_line }}<br>
    <strong>Submitted:</strong> {{ $submitted_at ?? '—' }}
</div>

<p style="margin:0;font-size:0.8125rem;color:#64748b;">Please keep your ticket ID for follow-up.</p>
@endsection
