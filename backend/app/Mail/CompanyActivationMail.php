<?php

namespace App\Mail;

use App\Models\Company;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CompanyActivationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Company $company,
        public string $activationUrl,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Activate Your Deliverex Company Account',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.company-activation',
        );
    }
}
