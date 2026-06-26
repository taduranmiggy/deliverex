@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;">Your driver account is ready</h1>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Hello {{ $user->name }},</p>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">A Deliverex administrator created your driver login. Use the credentials below for your first sign-in.</p>
<div style="margin:16px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:0.875rem;">
    <strong>Email:</strong> {{ $user->email }}<br>
    <strong>Temporary password:</strong> {{ $temporaryPassword }}
</div>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">You will be prompted to change your password after logging in. Open the driver app or web portal to start receiving assignments.</p>
<p style="margin:24px 0;"><a href="{{ $loginUrl }}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Sign In</a></p>
@endsection
