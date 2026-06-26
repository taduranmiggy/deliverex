<?php

namespace App\Services\Email;

use Illuminate\Support\Facades\View;

class MailTemplateService
{
    public function render(string $view, array $data = []): string
    {
        return View::make($view, $data)->render();
    }

    /** @param array<string, mixed> $cta */
    public function button(string $url, string $label, array $cta = []): string
    {
        $bg = $cta['bg'] ?? '#2563eb';

        return '<p style="margin:24px 0;">'
            .'<a href="'.e($url).'" style="display:inline-block;padding:12px 24px;background:'.$bg.';color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:0.9375rem;">'
            .e($label)
            .'</a></p>';
    }

    public function heading(string $text): string
    {
        return '<h1 style="margin:0 0 12px;font-size:1.375rem;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">'.e($text).'</h1>';
    }

    public function paragraph(string $text): string
    {
        return '<p style="margin:0 0 14px;font-size:0.9375rem;line-height:1.6;color:#334155;">'.nl2br(e($text)).'</p>';
    }

    public function infoBox(string $html): string
    {
        return '<div style="margin:16px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:0.875rem;color:#334155;">'.$html.'</div>';
    }
}
