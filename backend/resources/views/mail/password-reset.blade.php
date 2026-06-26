@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;">Reset your password</h1>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Hello {{ $user->name }},</p>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">We received a request to reset your Deliverex password. Click the button below to choose a new password.</p>
<p style="margin:24px 0;"><a href="{{ $resetUrl }}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Reset Password</a></p>
<p style="margin:0 0 14px;font-size:0.8125rem;color:#64748b;">This link expires in {{ $expiresMinutes }} minutes. If you did not request a reset, ignore this email.</p>
@endsection
