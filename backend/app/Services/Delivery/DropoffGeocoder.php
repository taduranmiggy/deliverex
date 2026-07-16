<?php

namespace App\Services\Delivery;


class DropoffGeocoder
{
    public function __construct(private AddressGeocoder $geocoder)
    {
    }

    /**
     * Resolve latitude/longitude for a drop-off address via OpenStreetMap Nominatim.
     *
     * @return array{lat: float, lng: float}|null
     */
    public function geocode(string $address): ?array
    {
        return $this->geocoder->geocode($address);
    }
}
