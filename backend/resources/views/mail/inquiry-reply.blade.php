@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;color:#0f172a;">Reply to your concern</h1>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Hello {{ $name }},</p>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">
    Our support team has responded to your concern
    <strong>{{ $reference_no }}</strong>@if(!empty($subject_line)) ({{ $subject_line }})@endif.
</p>

@if(!empty($original_message))
<div style="margin:0 0 14px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:0.875rem;color:#64748b;">
    <strong style="color:#334155;">Your message</strong><br>
    {{ $original_message }}
</div>
@endif

<div style="margin:0 0 14px;padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;font-size:0.9375rem;line-height:1.65;color:#1e3a8a;white-space:pre-wrap;">{{ $reply_body }}</div>

<p style="margin:0 0 8px;font-size:0.8125rem;color:#64748b;">
    Ticket ID: <strong>{{ $reference_no }}</strong>
    @if(!empty($replied_by_name)) · Replied by {{ $replied_by_name }}@endif
</p>
<p style="margin:0;font-size:0.8125rem;color:#64748b;">You can reply to this email if you need further assistance.</p>
@endsection
