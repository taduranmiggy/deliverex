<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Services\Email\EmailService;
use Illuminate\Support\Facades\Password;
use RuntimeException;

class UserInvitationService
{
    public function __construct(private readonly EmailService $email) {}

    public function sendInvitation(User $user): void
    {
        $email = strtolower(trim((string) $user->email));
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('Cannot send invitation without a valid user email.');
        }

        if ($user->email !== $email) {
            $user->forceFill(['email' => $email])->save();
        }

        $token = Password::broker('invitations')->createToken($user);

        if (! Password::broker('invitations')->tokenExists($user->fresh(), $token)) {
            throw new RuntimeException('Invitation token could not be verified immediately after creation.');
        }

        $frontend = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        // Prefer path-style token so email clients are less likely to break query strings.
        $activationUrl = $frontend
            .'/activate-account/'.$token
            .'?email='.rawurlencode($email);

        $this->email->sendUserInvitation($user->fresh(), $activationUrl);

        $user->forceFill([
            'invited_at' => now(),
            'invite_send_count' => (int) ($user->invite_send_count ?? 0) + 1,
        ])->save();
    }
}
