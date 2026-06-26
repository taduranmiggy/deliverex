<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TemplateMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $mailSubject,
        public string $htmlContent,
        public ?string $fromAddress = null,
        public ?string $fromName = null,
    ) {}

    public function envelope(): Envelope
    {
        $from = $this->fromAddress
            ? new Address($this->fromAddress, $this->fromName ?? config('mail.from.name'))
            : null;

        return new Envelope(
            subject: $this->mailSubject,
            from: $from,
        );
    }

    public function content(): Content
    {
        return new Content(htmlString: $this->htmlContent);
    }
}
