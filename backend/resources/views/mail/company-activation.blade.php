<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Activate Your Deliverex Company Account</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">
    <h1>Welcome to Deliverex</h1>
    <p>Hello {{ $company->contact_person ?? $company->company_name }},</p>
    <p>Your company account has been created by a Deliverex administrator.</p>
    <ul>
        <li><strong>Company:</strong> {{ $company->company_name }}</li>
        <li><strong>Email:</strong> {{ $company->company_email }}</li>
        @if($company->contact_number)
            <li><strong>Contact:</strong> {{ $company->contact_number }}</li>
        @endif
    </ul>
    <p>Click the button below to set your password and activate your account. This link expires in 72 hours.</p>
    <p>
        <a href="{{ $activationUrl }}" style="display:inline-block;padding:12px 24px;background:#c41e3a;color:#fff;text-decoration:none;border-radius:6px;">
            Activate Your Deliverex Company Account
        </a>
    </p>
    <p>If you did not expect this email, you can ignore it.</p>
</body>
</html>
