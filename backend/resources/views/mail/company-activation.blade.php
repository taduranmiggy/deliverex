@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;color:#0f172a;">Welcome to Deliverex</h1>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Hello {{ $company->contact_person ?? $company->company_name }},</p>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Your company account has been created by a Deliverex administrator.</p>
<div style="margin:16px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:0.875rem;color:#334155;">
    <strong>Company:</strong> {{ $company->company_name }}<br>
    <strong>Email:</strong> {{ $company->company_email }}
    @if($company->contact_number)
        <br><strong>Contact:</strong> {{ $company->contact_number }}
    @endif
</div>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">Click the button below to set your password and activate your account. This link expires in 72 hours.</p>
<p style="margin:24px 0;">
    <a href="{{ $activationUrl }}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Activate Company Account</a>
</p>
<p style="margin:0;font-size:0.8125rem;color:#64748b;">If you did not expect this email, you can ignore it.</p>
@endsection
