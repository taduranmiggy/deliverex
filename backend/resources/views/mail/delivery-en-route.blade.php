@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;">Driver en route</h1>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Your delivery <strong>{{ $trackingCode }}</strong> is now en route.</p>
@if(!empty($trackingUrl))
<p style="margin:24px 0;"><a href="{{ $trackingUrl }}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Track Live</a></p>
@endif
@endsection
