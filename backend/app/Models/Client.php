<?php

namespace App\Models;

/**
 * @deprecated Use Company model. Kept for backward compatibility during B2B migration.
 */
class Client extends Company
{
    protected $table = 'companies';

    protected $appends = ['client_name', 'email', 'phone'];

    public function getFillable()
    {
        return array_merge(parent::getFillable(), [
            'client_name',
            'email',
            'phone',
        ]);
    }

    public function setClientNameAttribute(?string $value): void
    {
        $this->attributes['company_name'] = $value;
    }

    public function getClientNameAttribute(): ?string
    {
        return $this->company_name;
    }

    public function setEmailAttribute(?string $value): void
    {
        $this->attributes['company_email'] = $value;
    }

    public function getEmailAttribute(): ?string
    {
        return $this->company_email;
    }

    public function setPhoneAttribute(?string $value): void
    {
        $this->attributes['contact_number'] = $value;
    }

    public function getPhoneAttribute(): ?string
    {
        return $this->contact_number;
    }
}
