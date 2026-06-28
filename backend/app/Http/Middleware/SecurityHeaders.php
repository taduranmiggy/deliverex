<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Attaches defensive HTTP security headers to every response.
 *
 * Purely additive: it never alters status codes, payloads, auth, or routing.
 * Existing headers are preserved (it only sets a header when not already present),
 * so anything a controller or the webserver sets explicitly still wins.
 *
 * Policy is driven by config/security.php and can be disabled via env.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! config('security.enabled', true)) {
            return $response;
        }

        $csp = config('security.csp');
        if (is_string($csp) && $csp !== '' && ! $response->headers->has('Content-Security-Policy')) {
            $response->headers->set('Content-Security-Policy', $csp);
        }

        foreach ((array) config('security.headers', []) as $name => $value) {
            if ($value !== null && $value !== '' && ! $response->headers->has($name)) {
                $response->headers->set($name, $value);
            }
        }

        $hsts = (array) config('security.hsts', []);
        if (($hsts['enabled'] ?? false) && $request->secure() && ! $response->headers->has('Strict-Transport-Security')) {
            $value = 'max-age=' . (int) ($hsts['max_age'] ?? 31536000);
            if ($hsts['include_subdomains'] ?? false) {
                $value .= '; includeSubDomains';
            }
            $response->headers->set('Strict-Transport-Security', $value);
        }

        return $response;
    }
}
