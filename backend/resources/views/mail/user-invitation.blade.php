@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;">You're invited to Deliverex</h1>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Hello {{ $user->name }},</p>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">An administrator created your account. Click the button below to set your password and activate access.</p>
<p style="margin:24px 0;"><a href="{{ $inviteUrl }}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Set Password & Activate</a></p>
<p style="margin:0 0 14px;font-size:0.8125rem;color:#64748b;">This secure link expires in {{ config('auth.passwords.users.expire', 60) }} minutes.</p>
@endsection

