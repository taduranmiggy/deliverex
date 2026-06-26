<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CompanyRoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        $membership = $user?->companyUser;

        if (! $membership || ! $membership->is_active) {
            return response()->json(['message' => 'Company membership required.'], 403);
        }

        if ($roles !== [] && ! in_array($membership->role, $roles, true)) {
            return response()->json(['message' => 'Insufficient company role.'], 403);
        }

        return $next($request);
    }
}
