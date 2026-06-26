@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;">{{ $alertType ?? 'System Alert' }}</h1>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Hello {{ $user->name }},</p>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">{{ $message ?? 'This is an automated notification from Deliverex.' }}</p>
@if(!empty($actionUrl) && !empty($actionLabel))
<p style="margin:24px 0;"><a href="{{ $actionUrl }}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">{{ $actionLabel }}</a></p>
@endif
@endsection
