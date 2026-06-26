# Deliverex Email Audit (Pre-Resend Integration)

Generated before Resend integration. See `docs/RESEND_EMAIL.md` for setup.

## Current Configuration

| Setting | Value |
|---------|-------|
| Default mailer | `MAIL_MAILER=log` (local) / `log` in production provision script |
| SMTP | Configured in `config/mail.php` but unused in production |
| Gmail | `InquiryController` hardcoded `deliverex.support@gmail.com` |
| Resend transport | Defined in `config/mail.php` + `config/services.php` but not wired |

## Files Using Email

| File | Usage |
|------|-------|
| `app/Mail/CompanyActivationMail.php` | Mailable for company activation |
| `app/Services/Company/CompanyService.php` | `Mail::to()` activation (swallows errors) |
| `app/Http/Controllers/Customer/InquiryController.php` | `Mail::raw()` to Gmail support |
| `app/Http/Controllers/Auth/AuthController.php` | `sendEmailVerificationNotification()` (Laravel default) |
| `app/Models/User.php` | `MustVerifyEmail` + `Notifiable` |

## Services (In-App Only — No Email)

| File | Notes |
|------|-------|
| `app/Services/Notifications/NotificationDispatcher.php` | Creates `NotificationLog` rows only; no email |

## Controllers Triggering Notifications (In-App)

- `Driver/StatusController.php` — status updates
- `Driver/TrackingController.php`
- `Driver/DocumentController.php`
- `Driver/CompletionProofController.php`
- `Driver/IssueController.php`, `DelayController.php`
- `Dispatcher/AssignmentController.php`
- `Admin/OcrReviewController.php`

## Email Templates (Before)

| Template | Path |
|----------|------|
| Company activation | `resources/views/mail/company-activation.blade.php` |

## Missing Flows (Before)

- Password reset API + email
- Driver account creation email
- Company user invitation email
- Delivery status emails to customers
- POD notification email
- System alert emails (login, session, account disabled)

## Scheduled Emails

None configured.
