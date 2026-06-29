<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Services\Company\CompanyService;
use App\Support\AuditLogger;
use Illuminate\Http\Request;

class CompanyController extends Controller
{
    public function __construct(private readonly CompanyService $companies) {}

    public function index(Request $request)
    {
        $query = Company::query()->with('creator')->latest();

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('company_name', 'like', "%{$search}%")
                    ->orWhere('company_email', 'like', "%{$search}%");
            });
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 6)));

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'company_name' => 'required|string|max:180',
            'company_email' => 'required|email|max:255|unique:companies,company_email',
            'contact_person' => 'nullable|string|max:120',
            'contact_number' => 'nullable|string|max:50',
            'address' => 'nullable|string',
        ]);

        $company = $this->companies->createPendingCompany($data, $request->user());

        AuditLogger::record($request->user(), 'company.created', Company::class, $company->id, [
            'company_email' => $company->company_email,
        ], $request);

        return response()->json($company, 201);
    }

    public function show(Company $company)
    {
        return response()->json($company->load(['creator', 'companyUsers.user']));
    }

    public function update(Request $request, Company $company)
    {
        $data = $request->validate([
            'company_name' => 'sometimes|string|max:180',
            'company_email' => 'sometimes|email|max:255|unique:companies,company_email,'.$company->id,
            'contact_person' => 'nullable|string|max:120',
            'contact_number' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'status' => 'sometimes|in:pending_activation,active,inactive,archived',
        ]);

        $company->update($data);

        if (($data['status'] ?? null) === Company::STATUS_ACTIVE) {
            $this->companies->ensureOwnerMembership($company->fresh());
        }

        AuditLogger::record($request->user(), 'company.updated', Company::class, $company->id, $data, $request);

        return response()->json($company->fresh());
    }

    public function resendActivation(Request $request, Company $company)
    {
        return response()->json([
            'message' => 'Account invitations are now managed in User Management.',
        ], 422);
    }
}
