<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Services\Email\EmailService;
use Illuminate\Support\Facades\Password;

class UserInvitationService
{
    public function __construct(private readonly EmailService $email) {}

    public function sendInvitation(User $user): void
    {
        $token = Password::broker()->createToken($user);
        $activationUrl = rtrim(config('app.frontend_url', config('app.url')), '/')
            .'/activate-account?token='.urlencode($token)
            .'&email='.urlencode($user->email);

        $this->email->sendUserInvitation($user, $activationUrl);

        $user->forceFill([
            'invited_at' => now(),
            'invite_send_count' => (int) ($user->invite_send_count ?? 0) + 1,
        ])->save();
    }
}

