<?php

namespace App\Models;

/**
 * @deprecated Use CompanyQuarryVehiclePreference.
 */
class ClientQuarryVehiclePreference extends CompanyQuarryVehiclePreference
{
    public function client()
    {
        return $this->company();
    }

    public function setClientIdAttribute($value): void
    {
        $this->attributes['company_id'] = $value;
    }

    public function getClientIdAttribute()
    {
        return $this->company_id;
    }
}
