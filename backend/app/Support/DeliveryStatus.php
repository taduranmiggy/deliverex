<?php

namespace App\Support;

final class DeliveryStatus
{
    public const ASSIGNED = 'assigned';
    public const EN_ROUTE_TO_PICKUP = 'en_route_to_pickup';
    public const ARRIVED_AT_PICKUP = 'arrived_at_pickup';
    public const EN_ROUTE_TO_DESTINATION = 'en_route_to_destination';
    public const ARRIVED_AT_DESTINATION = 'arrived_at_destination';

    /** Legacy assignment status string — canonicalize() maps this to {@see ARRIVED_AT_DESTINATION}. */
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
            self::ARRIVED_AT_DESTINATION,
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
            self::ARRIVED_AT_DESTINATION => 'Arrived at Destination',
            self::COMPLETED => 'Completed',
            self::CANCELLED => 'Cancelled',
        ];
    }

    /** Customer-safe display labels for public tracking. */
    public static function customerLabels(): array
    {
        return [
            self::ASSIGNED => 'Assigned',
            self::EN_ROUTE_TO_PICKUP => 'En Route to Pickup',
            self::ARRIVED_AT_PICKUP => 'Picked Up',
            self::EN_ROUTE_TO_DESTINATION => 'En Route',
            self::ARRIVED_AT_DESTINATION => 'Arrived',
            self::COMPLETED => 'Completed',
            self::CANCELLED => 'Cancelled',
        ];
    }

    public static function customerLabel(string $status): string
    {
        $canonical = self::canonicalize($status) ?? $status;

        return self::customerLabels()[$canonical] ?? self::label($canonical);
    }

    /** @return list<string> */
    public static function customerTimeline(): array
    {
        return self::lifecycle();
    }

    public static function label(string $status): string
    {
        $canonical = self::canonicalize($status) ?? $status;

        return self::labels()[$canonical] ?? ucwords(str_replace('_', ' ', $canonical));
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
            'arrived_at_destination', 'arrived at destination', 'arrived' => self::ARRIVED_AT_DESTINATION,
            'completed', 'delivered' => self::COMPLETED,
            'cancelled', 'canceled', 'rejected' => self::CANCELLED,
            'pending' => self::ASSIGNED,
            default => null,
        };
    }

    public static function previous(string $status): ?string
    {
        $canonical = self::canonicalize($status);
        if (! $canonical) {
            return null;
        }

        $index = array_search($canonical, self::lifecycle(), true);

        return ($index !== false && $index > 0) ? self::lifecycle()[$index - 1] : null;
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
        $canonical = self::canonicalize($status) ?? $status;

        return match ($canonical) {
            self::ASSIGNED => self::EN_ROUTE_TO_PICKUP,
            self::EN_ROUTE_TO_PICKUP => self::ARRIVED_AT_PICKUP,
            self::ARRIVED_AT_PICKUP => self::EN_ROUTE_TO_DESTINATION,
            self::EN_ROUTE_TO_DESTINATION => self::ARRIVED_AT_DESTINATION,
            self::ARRIVED_AT_DESTINATION => self::COMPLETED,
            default => null,
        };
    }

    /** @return list<string> Canonical statuses that block driver/vehicle reuse. */
    public static function availabilityBlocking(): array
    {
        return [
            self::ASSIGNED,
            self::EN_ROUTE_TO_PICKUP,
            self::ARRIVED_AT_PICKUP,
            self::EN_ROUTE_TO_DESTINATION,
            self::ARRIVED_AT_DESTINATION,
            self::ARRIVED,
        ];
    }

    /**
     * Raw assignment.status values stored in the database that block reuse.
     * Includes legacy aliases so SQL whereIn matches historical rows.
     *
     * @return list<string>
     */
    public static function availabilityBlockingRawValues(): array
    {
        return array_values(array_unique([
            self::ASSIGNED,
            self::EN_ROUTE_TO_PICKUP,
            self::ARRIVED_AT_PICKUP,
            self::EN_ROUTE_TO_DESTINATION,
            self::ARRIVED_AT_DESTINATION,
            self::ARRIVED,
            'dispatched',
            'pending',
            'in_progress',
            'en_route',
            'en route',
            'en route to pickup',
            'arrived at pickup',
            'en route to destination',
            'arrived at destination',
        ]));
    }

    public static function applyAvailabilityBlockingScope(\Illuminate\Database\Eloquent\Builder $query, string $column = 'status'): \Illuminate\Database\Eloquent\Builder
    {
        return $query->whereIn($column, self::availabilityBlockingRawValues());
    }

    /** @return list<string> */
    public static function terminal(): array
    {
        return [
            self::COMPLETED,
            self::CANCELLED,
            'rejected',
        ];
    }

    public static function isActive(string $status): bool
    {
        $canonical = self::canonicalize($status);

        return in_array($canonical, self::availabilityBlocking(), true);
    }

    public static function isTerminal(string $status): bool
    {
        $canonical = self::canonicalize($status) ?? strtolower(trim($status));

        return in_array($canonical, self::terminal(), true);
    }

    public static function blocksDriverAvailability(string $status): bool
    {
        return self::isActive($status);
    }

    public static function allowsOcrUpload(string $status): bool
    {
        $canonical = self::canonicalize($status);

        return in_array($canonical, [self::ARRIVED_AT_DESTINATION, self::COMPLETED], true)
            || in_array(strtolower(trim($status)), [self::ARRIVED, self::COMPLETED], true);
    }

    /**
     * Dispatcher monitoring phase grouping.
     *
     * @return 'assigned'|'pickup'|'delivery'|'completed'|'cancelled'|null
     */
    public static function dispatcherPhase(string $status): ?string
    {
        $canonical = self::canonicalize($status);
        if (! $canonical) {
            return null;
        }

        return match ($canonical) {
            self::ASSIGNED => 'assigned',
            self::EN_ROUTE_TO_PICKUP, self::ARRIVED_AT_PICKUP => 'pickup',
            self::EN_ROUTE_TO_DESTINATION, self::ARRIVED_AT_DESTINATION => 'delivery',
            self::COMPLETED => 'completed',
            self::CANCELLED => 'cancelled',
            default => null,
        };
    }

    public static function toVehicleStatus(string $assignmentStatus): string
    {
        $canonical = self::canonicalize($assignmentStatus) ?? $assignmentStatus;

        return match ($canonical) {
            self::ASSIGNED => 'assigned',
            self::EN_ROUTE_TO_PICKUP,
            self::ARRIVED_AT_PICKUP,
            self::EN_ROUTE_TO_DESTINATION,
            self::ARRIVED_AT_DESTINATION => 'in_operation',
            self::ARRIVED => 'in_operation',
            default => 'available',
        };
    }

    public static function vehicleInOperationStatuses(): array
    {
        return ['assigned', 'in_operation', 'in_use'];
    }

    /** @return array{label:string,next_status:?string} */
    public static function nextAction(string $status): array
    {
        $canonical = self::canonicalize($status) ?? $status;
        $next = self::next($canonical);

        $label = match ($canonical) {
            self::ASSIGNED => 'Start Trip to Pickup',
            self::EN_ROUTE_TO_PICKUP => 'Arrived at Pickup',
            self::ARRIVED_AT_PICKUP => 'Start Delivery',
            self::EN_ROUTE_TO_DESTINATION => 'Arrived at Destination',
            self::ARRIVED_AT_DESTINATION => 'Complete Delivery',
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
            self::ARRIVED_AT_DESTINATION => 'arrived',
            self::COMPLETED => 'completed',
            self::CANCELLED => 'cancelled',
            default => 'assigned',
        };
    }

    public static function milestoneNotificationTitle(string $status): ?string
    {
        $canonical = self::canonicalize($status);

        return match ($canonical) {
            self::EN_ROUTE_TO_PICKUP => 'Driver started trip to pickup',
            self::ARRIVED_AT_PICKUP => 'Driver arrived at pickup',
            self::EN_ROUTE_TO_DESTINATION => 'Delivery is now in transit',
            self::ARRIVED_AT_DESTINATION => 'Driver arrived at destination',
            self::COMPLETED => 'Delivery completed',
            default => null,
        };
    }
}
