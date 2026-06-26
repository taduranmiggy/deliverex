<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $subject ?? 'Deliverex' }}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
<tr>
<td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:24px 28px;">
<table role="presentation" width="100%"><tr>
<td style="color:#fff;font-size:1.25rem;font-weight:800;letter-spacing:-0.02em;">Deliverex</td>
<td align="right" style="color:rgba(255,255,255,0.85);font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Logistics Platform</td>
</tr></table>
</td>
</tr>
<tr>
<td style="padding:28px;">
@yield('content')
</td>
</tr>
<tr>
<td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:0.75rem;color:#64748b;line-height:1.6;">
<p style="margin:0 0 8px;">&copy; {{ date('Y') }} Deliverex. All rights reserved.</p>
<p style="margin:0;">Need help? Contact <a href="mailto:support@deliverexapp.com" style="color:#2563eb;">support@deliverexapp.com</a></p>
@if(!empty($footerNote))
<p style="margin:8px 0 0;">{{ $footerNote }}</p>
@endif
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>
