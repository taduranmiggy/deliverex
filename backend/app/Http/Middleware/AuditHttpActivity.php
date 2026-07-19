<?php

namespace App\Http\Middleware;

use App\Support\AuditLogger;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Central audit safety net for API activity.
 *
 * Domain-specific controller logs remain authoritative. This middleware fills
 * every gap and records failed operations without requiring logging code in
 * each controller.
 */
class AuditHttpActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            /** @var Response $response */
            $response = $next($request);
        } catch (\Throwable $exception) {
            $this->recordIfNeeded($request, null, $exception);
            throw $exception;
        }

        $this->recordIfNeeded($request, $response);

        return $response;
    }

    private function recordIfNeeded(Request $request, ?Response $response, ?\Throwable $exception = null): void
    {
        if (! $this->shouldAudit($request, $response, $exception)) {
            return;
        }

        [$module, $prefix, $resource] = $this->classify($request);
        $statusCode = $response?->getStatusCode() ?? 500;
        $status = ($exception === null && $statusCode < 400) ? 'success' : 'failed';
        $verb = $this->resolveVerb($request, $status);
        [$subjectType, $subjectId] = $this->resolveSubject($request);
        $actor = $request->user();
        $recordSuffix = $subjectId !== null ? ' #'.$subjectId : '';
        $description = sprintf(
            '%s %s %s%s%s.',
            $actor?->name ?? 'Guest/System',
            str_replace('_', ' ', $verb),
            $resource,
            $recordSuffix,
            $status === 'failed' ? ' (failed)' : '',
        );

        AuditLogger::record(
            $actor,
            $prefix.'.'.$verb,
            $subjectType,
            $subjectId,
            [
                'http_method' => $request->method(),
                'path' => '/'.$request->path(),
                'http_status' => $statusCode,
                'request_fields' => $this->safeRequestFields($request),
                'query_filters' => $this->safeQueryFilters($request),
                'error_type' => $exception ? class_basename($exception) : null,
            ],
            $request,
            description: $description,
            status: $status,
            module: $module,
        );
    }

    private function shouldAudit(Request $request, ?Response $response, ?\Throwable $exception): bool
    {
        if (! $request->is('api/*') || $request->attributes->get('audit_log_recorded') === true) {
            return false;
        }

        $path = strtolower($request->path());

        if ($request->isMethod('GET')) {
            if (in_array($path, [
                'api/auth/me',
                'api/auth/session',
                'api/notifications',
                'api/exports/preview',
            ], true)) {
                return false;
            }

            return $request->user() !== null;
        }

        if ($exception === null && $response?->getStatusCode() < 400 && (
            str_starts_with($path, 'api/driver/tracking')
            || str_starts_with($path, 'api/mobile/location/update')
        )) {
            // High-frequency telemetry is retained in tracking tables. Only
            // failures belong in the human-facing enterprise audit trail.
            return false;
        }

        return true;
    }

    /** @return array{0: string, 1: string, 2: string} */
    private function classify(Request $request): array
    {
        $path = strtolower(trim(preg_replace('#^api/#', '', $request->path()), '/'));

        return match (true) {
            str_starts_with($path, 'manager/dashboard') => ['Dashboard', 'dashboard', 'dashboard'],
            str_contains($path, 'audit-logs') => ['Audit Logs', 'audit', 'audit logs'],
            str_contains($path, 'email-logs') => ['Email Monitoring', 'email', 'email log'],
            str_contains($path, 'notifications') => ['Notifications', 'notification', 'notification'],
            str_contains($path, 'calendar') => ['Calendar', 'calendar', 'calendar'],
            str_contains($path, 'analytics') || str_contains($path, 'driver-performance') || str_contains($path, 'vehicle-utilization') => ['Analytics', 'analytics', 'analytics'],
            str_contains($path, 'reports') || str_contains($path, 'exports') => ['Reports', 'reports', 'report'],
            str_contains($path, 'ocr') => ['OCR Review', 'ocr', 'OCR review'],
            str_contains($path, 'tracking') || str_contains($path, '/map') || str_contains($path, 'fleet-live') || str_contains($path, 'location/update') => ['Tracking', 'tracking', 'tracking record'],
            str_contains($path, 'job-orders') => ['Job Orders', 'job_order', 'job order'],
            str_contains($path, 'assignments') || str_contains($path, 'best-fit') || str_contains($path, 'fleet/') || str_contains($path, 'delays') => ['Fleet Dispatch', 'dispatch', 'fleet dispatch record'],
            str_contains($path, 'companies') || str_starts_with($path, 'company/users') => ['Company Management', 'company', 'company'],
            str_contains($path, 'customer/portal') || str_contains($path, 'link-delivery') => ['Customer Management', 'customer', 'customer record'],
            str_contains($path, 'profile') => ['Profile Management', 'profile', 'profile'],
            str_contains($path, 'drivers') || str_starts_with($path, 'driver/') => ['Driver Management', 'driver', 'driver record'],
            str_contains($path, 'vehicles') => ['Vehicle Management', 'vehicle', 'vehicle'],
            str_contains($path, 'users') || str_contains($path, 'roles') => ['User Management', 'user', 'user'],
            str_contains($path, 'master-data') => ['Settings', 'settings', 'setting'],
            str_contains($path, 'inquir') || str_contains($path, 'concerns') => ['Support Inquiries', 'inquiry', 'support inquiry'],
            str_contains($path, 'chatbot') || str_contains($path, 'issues') => ['Support / Chatbox', 'support', 'support activity'],
            str_starts_with($path, 'auth/') => ['Authentication', 'auth', 'authentication request'],
            default => ['System Logs', 'system', 'system record'],
        };
    }

    private function resolveVerb(Request $request, string $status): string
    {
        $path = strtolower($request->path());
        $requestedAction = strtolower((string) $request->input('action', ''));

        if ($status === 'failed') {
            return match (true) {
                str_contains($path, 'login') => 'login_failed',
                str_contains($path, 'export') => 'export_failed',
                str_contains($path, 'import') => 'import_failed',
                default => strtolower($request->method()).'_failed',
            };
        }

        return match (true) {
            str_contains($path, 'login') => 'login',
            str_contains($path, 'logout') => 'logout',
            str_contains($path, 'forgot-password') => 'password_reset_requested',
            str_contains($path, 'reset-password') => 'password_reset',
            str_contains($path, 'change-password') => 'password_changed',
            str_contains($path, 'export') => 'exported_'.strtolower((string) $request->query('format', 'pdf')),
            str_contains($path, 'import') => 'imported',
            in_array($requestedAction, ['approve', 'reject'], true) => $requestedAction.'d',
            str_contains($path, 'assignments') && $request->isMethod('POST') => 'assigned',
            str_contains($path, 'status') => 'status_changed',
            str_contains($path, '/read') => 'marked_read',
            str_contains($path, 'acknowledge') => 'acknowledged',
            str_contains($path, 'reconcile') => 'reconciled',
            str_contains($path, 'retry') => 'retried',
            str_contains($path, 'send-invite') => 'invite_sent',
            $request->isMethod('GET') => 'viewed',
            $request->isMethod('POST') => 'created',
            $request->isMethod('PUT') || $request->isMethod('PATCH') => 'updated',
            $request->isMethod('DELETE') => 'deleted',
            default => strtolower($request->method()),
        };
    }

    /** @return array{0: class-string<Model>|null, 1: int|null} */
    private function resolveSubject(Request $request): array
    {
        $parameters = array_reverse($request->route()?->parameters() ?? []);

        foreach ($parameters as $parameter) {
            if ($parameter instanceof Model) {
                $key = $parameter->getKey();

                return [$parameter::class, is_numeric($key) ? (int) $key : null];
            }

            if (is_numeric($parameter)) {
                return [null, (int) $parameter];
            }
        }

        foreach (['id', 'job_order_id', 'assignment_id', 'driver_id', 'vehicle_id'] as $key) {
            $value = $request->input($key);
            if (is_numeric($value)) {
                return [null, (int) $value];
            }
        }

        return [null, null];
    }

    /** @return list<string> */
    private function safeRequestFields(Request $request): array
    {
        $redacted = config('audit.redact_fields', []);

        return array_values(array_diff(array_keys($request->except($redacted)), $redacted));
    }

    /** @return array<string, scalar|null> */
    private function safeQueryFilters(Request $request): array
    {
        return collect($request->query())
            ->except(['token', 'refresh_token'])
            ->filter(fn ($value) => is_scalar($value) || $value === null)
            ->map(fn ($value) => is_string($value) ? mb_substr($value, 0, 200) : $value)
            ->all();
    }
}
