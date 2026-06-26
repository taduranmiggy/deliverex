@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;">We received your message</h1>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Hello {{ $name }},</p>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Thank you for contacting Deliverex. Your inquiry <strong>{{ $reference_no }}</strong> has been received and our team will respond shortly.</p>
<p style="margin:0;font-size:0.8125rem;color:#64748b;">Subject: {{ $subject_line }}</p>
@endsection
