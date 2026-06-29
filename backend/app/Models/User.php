<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Auth\MustVerifyEmail as MustVerifyEmailTrait;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\URL;
use App\Services\Email\EmailService;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, MustVerifyEmailTrait;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'role_id',
        'name',
        'email',
        'password',
        'phone',
        'status',
        'must_change_password',
        'password_changed_at',
        'invited_at',
        'invitation_accepted_at',
        'invite_send_count',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'locked_until' => 'datetime',
            'must_change_password' => 'boolean',
            'password_changed_at' => 'datetime',
            'invited_at' => 'datetime',
            'invitation_accepted_at' => 'datetime',
        ];
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function driver()
    {
        return $this->hasOne(Driver::class);
    }

    public function notificationLogs()
    {
        return $this->hasMany(NotificationLog::class);
    }

    public function jobOrders()
    {
        return $this->hasMany(JobOrder::class, 'created_by');
    }

    /** Job orders booked under this customer account. */
    public function customerJobOrders()
    {
        return $this->hasMany(JobOrder::class, 'customer_user_id');
    }

    public function companyUser()
    {
        return $this->hasOne(CompanyUser::class);
    }

    public function company()
    {
        return $this->hasOneThrough(Company::class, CompanyUser::class, 'user_id', 'id', 'id', 'company_id');
    }

    public function isCompanyOwner(): bool
    {
        return $this->companyUser?->isOwner() ?? false;
    }

    public function assignmentsCreated()
    {
        return $this->hasMany(DispatchAssignment::class, 'assigned_by');
    }

    public function sendPasswordResetNotification($token): void
    {
        $url = rtrim(config('app.frontend_url', config('app.url')), '/')
            .'/reset-password?token='.urlencode($token)
            .'&email='.urlencode($this->email);

        app(EmailService::class)->sendPasswordReset($this, $url);
    }

    public function sendEmailVerificationNotification(): void
    {
        $verificationUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $this->id, 'hash' => sha1($this->getEmailForVerification())]
        );

        app(EmailService::class)->sendEmailVerification($this, $verificationUrl);
    }
}
