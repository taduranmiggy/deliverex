# Resend Email Integration — Deliverex

## Overview

Deliverex uses [Resend](https://resend.com) as the primary email provider via Laravel's native `resend` mail transport.

## Environment Variables

Add to `backend/.env` (local) and production secrets (never commit keys):

```env
MAIL_MAILER=resend
MAIL_FROM_ADDRESS=noreply@deliverexapp.com
MAIL_FROM_NAME=Deliverex
MAIL_ACCOUNTS_ADDRESS=accounts@deliverexapp.com
MAIL_SUPPORT_ADDRESS=deliverexapp@gmail.com
MAIL_SUPPORT_FROM=noreply@deliverexapp.com
RESEND_API_KEY=re_xxxxxxxx
FRONTEND_URL=https://deliverexapp.com
MAIL_QUEUE=false
```

**Important:** Resend cannot send *from* `@gmail.com`. Keep `MAIL_SUPPORT_ADDRESS` as your Gmail inbox for receiving replies, and set `MAIL_SUPPORT_FROM` to an address on your verified domain (`deliverexapp.com`).

For production, add `RESEND_API_KEY` to `~/.deploy.secrets` on Hostinger:

```bash
RESEND_API_KEY=re_xxxxxxxx
```

Then re-run: `bash scripts/hostinger-hpanel-git-deploy.sh`

## Domain Verification (Resend Dashboard)

Verify `deliverexapp.com` and configure sender addresses:

- `noreply@deliverexapp.com` — transactional (password reset, delivery updates, inquiry replies From)
- `accounts@deliverexapp.com` — company activation, driver credentials
- `deliverexapp@gmail.com` — staff inbox / Reply-To for customer concerns (not used as Resend From)

## Architecture

| Service | Role |
|---------|------|
| `EmailService` | High-level send methods for all flows |
| `ResendService` | Sends via Laravel Mail + logs result |
| `MailTemplateService` | HTML template helpers |
| `SendEmailJob` | Optional queued send with 3 retries |
| `email_logs` table | Audit trail (recipient, type, status, failure reason) |

## Email Flows

- Company activation (admin creates company)
- Company user invitation (owner adds staff)
- Driver credentials (Master Data → Generate Account)
- Password reset (`POST /auth/forgot-password`)
- Email verification
- Delivery notifications (assigned, en route, arrived, completed, POD)
- Support inquiry + customer confirmation
- Account disabled alert

## Admin Monitoring

**Admin → Email Logs** — filter by status, type, recipient; retry failed emails.

API: `GET /admin/email-logs`, `POST /admin/email-logs/{id}/retry`

## Local Development

1. Copy `backend/.env.example` → `backend/.env`
2. Set `RESEND_API_KEY` from [resend.com/api-keys](https://resend.com/api-keys)
3. Run `composer install` in `backend/`
4. Run `php artisan migrate`
5. Test: create a company in Admin → Companies (activation email logged in Email Logs)

Without an API key, set `MAIL_MAILER=log` temporarily — emails write to `storage/logs/laravel.log`.

## Production Deployment

1. Verify domain in Resend
2. Add `RESEND_API_KEY` to server secrets
3. Push to `main` (auto-deploy) or run deploy script
4. Run migration: `php artisan migrate --force`
5. Test company activation + check Admin → Email Logs

## Queue (Optional)

Set `MAIL_QUEUE=true` and run `php artisan queue:work` for async delivery with automatic retries.

## Security

- **Never commit API keys** to git
- Rotate keys if exposed in chat or logs
- Use separate Resend API keys for staging vs production when possible

See also: [docs/EMAIL_AUDIT.md](./EMAIL_AUDIT.md) for pre-integration audit.
