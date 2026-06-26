@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;">Delivery assigned</h1>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Hello {{ $customerName ?? 'there' }},</p>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Your delivery <strong>{{ $trackingCode }}</strong> has been assigned to a driver and is being prepared for dispatch.</p>
@if(!empty($trackingUrl))
<p style="margin:24px 0;"><a href="{{ $trackingUrl }}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Track Delivery</a></p>
@endif
@endsection
