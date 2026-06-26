@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;">You're invited to {{ $company->company_name }}</h1>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Hello {{ $user->name }},</p>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">You have been added as a team member for <strong>{{ $company->company_name }}</strong> on Deliverex.</p>
<div style="margin:16px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:0.875rem;">
    <strong>Login email:</strong> {{ $user->email }}<br>
    <strong>Temporary password:</strong> {{ $temporaryPassword }}
</div>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Sign in and change your password on first login.</p>
<p style="margin:24px 0;"><a href="{{ $loginUrl }}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Sign In to Deliverex</a></p>
@endsection
