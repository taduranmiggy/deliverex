<?php

namespace App\Support;

final class DeliveryStatus
{
    public const ASSIGNED = 'assigned';
    public const EN_ROUTE_TO_PICKUP = 'en_route_to_pickup';
    public const ARRIVED_AT_PICKUP = 'arrived_at_pickup';
    public const EN_ROUTE_TO_DESTINATION = 'en_route_to_destination';
    public const ARRIVED = 'arrived';
    public const COMPLETED = 'completed';
    public const CANCELLED = 'cancelled';

    /** @return list<string> */
    public static function lifecycle(): array
    {
        return [
            self::ASSIGNED,
            self::EN_ROUTE_TO_PICKUP,
            self::ARRIVED_AT_PICKUP,
            self::EN_ROUTE_TO_DESTINATION,
            self::ARRIVED,
            self::COMPLETED,
        ];
    }

    /** @return array<string, string> */
    public static function labels(): array
    {
        return [
            self::ASSIGNED => 'Assigned',
            self::EN_ROUTE_TO_PICKUP => 'En Route to Pickup',
            self::ARRIVED_AT_PICKUP => 'Arrived at Pickup',
            self::EN_ROUTE_TO_DESTINATION => 'En Route to Destination',
            self::ARRIVED => 'Arrived',
            self::COMPLETED => 'Completed',
            self::CANCELLED => 'Cancelled',
        ];
    }

    public static function label(string $status): string
    {
        return self::labels()[$status] ?? ucwords(str_replace('_', ' ', $status));
    }

    public static function canonicalize(?string $status): ?string
    {
        if (! is_string($status)) {
            return null;
        }

        $value = strtolower(trim($status));

        return match ($value) {
            'assigned', 'dispatched' => self::ASSIGNED,
            'en_route_to_pickup', 'en route to pickup' => self::EN_ROUTE_TO_PICKUP,
            'arrived_at_pickup', 'arrived at pickup' => self::ARRIVED_AT_PICKUP,
            'en_route_to_destination', 'en route to destination', 'en_route', 'en route', 'in_progress' => self::EN_ROUTE_TO_DESTINATION,
            'arrived' => self::ARRIVED,
            'completed', 'delivered' => self::COMPLETED,
            'cancelled', 'canceled' => self::CANCELLED,
            // Legacy compatibility mapping.
            'pending' => self::ASSIGNED,
            default => null,
        };
    }

    public static function canTransition(string $current, string $next): bool
    {
        $currentCanonical = self::canonicalize($current);
        $nextCanonical = self::canonicalize($next);

        if (! $currentCanonical || ! $nextCanonical) {
            return false;
        }

        if ($currentCanonical === $nextCanonical) {
            return true;
        }

        if ($nextCanonical === self::CANCELLED) {
            return true;
        }

        return self::next($currentCanonical) === $nextCanonical;
    }

    public static function next(string $status): ?string
    {
        return match ($status) {
            self::ASSIGNED => self::EN_ROUTE_TO_PICKUP,
            self::EN_ROUTE_TO_PICKUP => self::ARRIVED_AT_PICKUP,
            self::ARRIVED_AT_PICKUP => self::EN_ROUTE_TO_DESTINATION,
            self::EN_ROUTE_TO_DESTINATION => self::ARRIVED,
            self::ARRIVED => self::COMPLETED,
            default => null,
        };
    }

    public static function isActive(string $status): bool
    {
        $canonical = self::canonicalize($status);

        return in_array($canonical, [
            self::ASSIGNED,
            self::EN_ROUTE_TO_PICKUP,
            self::ARRIVED_AT_PICKUP,
            self::EN_ROUTE_TO_DESTINATION,
            self::ARRIVED,
        ], true);
    }

    /** @return array{label:string,next_status:?string} */
    public static function nextAction(string $status): array
    {
        $canonical = self::canonicalize($status) ?? $status;
        $next = self::next($canonical);

        $label = match ($canonical) {
            self::ASSIGNED => 'Start Pickup',
            self::EN_ROUTE_TO_PICKUP => 'Arrived at Pickup',
            self::ARRIVED_AT_PICKUP => 'Start Delivery',
            self::EN_ROUTE_TO_DESTINATION => 'Arrived',
            self::ARRIVED => 'Complete Delivery',
            default => 'No Action Available',
        };

        return ['label' => $label, 'next_status' => $next];
    }

    public static function toJobOrderStatus(string $assignmentStatus): string
    {
        $canonical = self::canonicalize($assignmentStatus) ?? $assignmentStatus;

        return match ($canonical) {
            self::ASSIGNED => 'assigned',
            self::EN_ROUTE_TO_PICKUP,
            self::ARRIVED_AT_PICKUP,
            self::EN_ROUTE_TO_DESTINATION => 'in_progress',
            self::ARRIVED => 'arrived',
            self::COMPLETED => 'completed',
            self::CANCELLED => 'cancelled',
            default => 'assigned',
        };
    }
}
