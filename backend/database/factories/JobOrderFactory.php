<?php

namespace Database\Factories;

use App\Models\JobOrder;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<JobOrder>
 */
class JobOrderFactory extends Factory
{
    protected $model = JobOrder::class;

    public function definition(): array
    {
        return [
            'tracking_code' => strtoupper(Str::random(10)),
            'customer_name' => fake()->name(),
            'customer_contact' => fake()->phoneNumber(),
            'pickup_location' => fake()->address(),
            'dropoff_location' => fake()->address(),
            'job_requirements' => fake()->sentence(),
            'vehicle_type_required' => fake()->randomElement(['Dump Truck', 'Flatbed', 'Cargo Van']),
            'vehicle_capacity_required' => fake()->randomElement(['5T', '8T', '10T']),
            'status' => 'pending',
        ];
    }
}
