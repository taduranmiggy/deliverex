@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 8px;font-size:1.375rem;font-weight:800;color:#0f172a;">New customer concern</h1>
<p style="margin:0 0 18px;font-size:0.875rem;line-height:1.5;color:#64748b;">A concern was submitted through {{ $source === 'chatbot' ? 'the chatbot assistant' : 'the support form' }}.</p>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;border-collapse:collapse;">
    <tr>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-size:0.8125rem;color:#64748b;width:38%;">Ticket ID</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;font-size:0.875rem;font-weight:700;color:#0f172a;">{{ $reference_no }}</td>
    </tr>
    <tr>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-size:0.8125rem;color:#64748b;">Priority</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;font-size:0.875rem;font-weight:700;color:#0f172a;">{{ $priority ?? 'Normal' }}</td>
    </tr>
    <tr>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-size:0.8125rem;color:#64748b;">Category</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;font-size:0.875rem;color:#0f172a;">{{ $inquiry_type_label ?? $inquiry_type }}</td>
    </tr>
    <tr>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-size:0.8125rem;color:#64748b;">Customer</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;font-size:0.875rem;color:#0f172a;">{{ $name }}</td>
    </tr>
    <tr>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-size:0.8125rem;color:#64748b;">Email</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;font-size:0.875rem;color:#0f172a;"><a href="mailto:{{ $email }}" style="color:#2563eb;text-decoration:none;">{{ $email }}</a></td>
    </tr>
    @if(!empty($phone))
    <tr>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-size:0.8125rem;color:#64748b;">Phone</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;font-size:0.875rem;color:#0f172a;">{{ $phone }}</td>
    </tr>
    @endif
    <tr>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-size:0.8125rem;color:#64748b;">Subject</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;font-size:0.875rem;color:#0f172a;">{{ $subject_line }}</td>
    </tr>
    <tr>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-size:0.8125rem;color:#64748b;">Submitted</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;font-size:0.875rem;color:#0f172a;">{{ $submitted_at ?? '—' }}</td>
    </tr>
</table>

<div style="margin:0 0 18px;padding:14px 16px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">
    <p style="margin:0 0 8px;font-size:0.8125rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Message</p>
    <p style="margin:0;font-size:0.9375rem;line-height:1.65;color:#334155;white-space:pre-wrap;">{{ $message_body }}</p>
</div>

@if(!empty($admin_url))
<p style="margin:0;">
    <a href="{{ $admin_url }}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-size:0.875rem;font-weight:700;">View Concern</a>
</p>
@endif
@endsection
