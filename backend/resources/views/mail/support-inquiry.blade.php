@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;">New support inquiry</h1>
<div style="margin:16px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:0.875rem;">
    <strong>Reference:</strong> {{ $reference_no }}<br>
    <strong>From:</strong> {{ $name }} &lt;{{ $email }}&gt;<br>
    @if(!empty($phone))<strong>Phone:</strong> {{ $phone }}<br>@endif
    <strong>Type:</strong> {{ $inquiry_type }}<br>
    <strong>Subject:</strong> {{ $subject_line }}
</div>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;white-space:pre-wrap;">{{ $message_body }}</p>
@endsection
