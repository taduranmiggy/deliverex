<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\Company\CompanyService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CompanyActivationController extends Controller
{
    public function __construct(private readonly CompanyService $companies) {}

    public function show(string $token)
    {
        try {
            $company = $this->companies->validateActivationToken($token);
        } catch (ValidationException $e) {
            return response()->json([
                'valid' => false,
                'message' => collect($e->errors())->flatten()->first(),
            ], 422);
        }

        return response()->json([
            'valid' => true,
            'company_name' => $company->company_name,
            'company_email' => $company->company_email,
            'contact_person' => $company->contact_person,
        ]);
    }

    public function activate(Request $request, string $token)
    {
        $data = $request->validate([
            'password' => 'required|string|min:8|confirmed',
        ]);

        $company = $this->companies->validateActivationToken($token);
        $result = $this->companies->activateCompany($company, $data['password'], $request);

        $response = response()->json([
            'message' => 'Company account activated successfully.',
            'token' => $result['token'],
            'access_token' => $result['access_token'],
            'expires_in' => $result['expires_in'],
            'session_id' => $result['session_id'],
            'user' => $result['user'],
        ]);

        if (! empty($result['refresh_token'])) {
            $response->headers->set('X-Refresh-Token', $result['refresh_token']);
        }

        return $response;
    }
}
