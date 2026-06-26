@extends('mail.layouts.deliverex')

@section('content')
<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;color:#0f172a;">Activate your company account</h1>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">
    Hello {{ $company->contact_person ?? $company->company_name }},
</p>
<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">
    Your Deliverex company portal has been set up by our team. Use the button below to create your password and start managing deliveries for <strong>{{ $company->company_name }}</strong>.
</p>

<div style="margin:16px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:0.875rem;color:#334155;line-height:1.7;">
    <strong style="color:#0f172a;">Account details</strong><br>
    Company: {{ $company->company_name }}<br>
    Login email: {{ $company->company_email }}
    @if($company->contact_number)
        <br>Contact: {{ $company->contact_number }}
    @endif
</div>

<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">
    This activation link is valid for <strong>72 hours</strong>. After that, ask your Deliverex administrator to resend it.
</p>

<p style="margin:24px 0;text-align:center;">
    <a href="{{ $activationUrl }}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:0.9375rem;">Activate company account</a>
</p>

<p style="margin:0 0 8px;font-size:0.8125rem;color:#64748b;line-height:1.6;">
    If the button does not work, copy and paste this link into your browser:
</p>
<p style="margin:0 0 16px;font-size:0.8125rem;word-break:break-all;">
    <a href="{{ $activationUrl }}" style="color:#2563eb;">{{ $activationUrl }}</a>
</p>

<p style="margin:0;font-size:0.8125rem;color:#64748b;line-height:1.6;">
    Did not expect this email? You can safely ignore it. For help, reply to this message or contact
    <a href="mailto:{{ config('mail.addresses.support') }}" style="color:#2563eb;">{{ config('mail.addresses.support') }}</a>.
</p>
@endsection
