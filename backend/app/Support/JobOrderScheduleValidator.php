<?php

namespace App\Support;

use App\Models\JobOrder;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class JobOrderScheduleValidator
{
    public const MESSAGE = 'Cannot create a booking for a past date. Please select today or a future date.';

    /**
     * @param  array<string, mixed>  $data
     */
    public static function validatePayload(array $data): void
    {
        $errors = [];

        foreach (['scheduled_start', 'scheduled_end'] as $field) {
            if (! array_key_exists($field, $data) || $data[$field] === null || $data[$field] === '') {
                continue;
            }

            if (self::isPast(Carbon::parse($data[$field]))) {
                $errors[$field] = [self::MESSAGE];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    public static function validateJobOrder(JobOrder $jobOrder): void
    {
        $errors = [];

        if ($jobOrder->scheduled_start && self::isPast($jobOrder->scheduled_start)) {
            $errors['scheduled_start'] = [self::MESSAGE];
        }

        if ($jobOrder->scheduled_end && self::isPast($jobOrder->scheduled_end)) {
            $errors['scheduled_end'] = [self::MESSAGE];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    public static function isPast(Carbon $value): bool
    {
        return $value->lt(now());
    }
}
