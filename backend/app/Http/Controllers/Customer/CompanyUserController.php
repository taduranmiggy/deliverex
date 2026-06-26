<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\CompanyUser;
use App\Services\Company\CompanyService;
use App\Services\Email\EmailService;
use App\Services\Email\EmailType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class CompanyUserController extends Controller
{
    public function __construct(
        private readonly CompanyService $companies,
        private readonly EmailService $email,
    ) {}

    public function index(Request $request)
    {
        $membership = $this->requireOwner($request);

        $users = CompanyUser::query()
            ->where('company_id', $membership->company_id)
            ->with('user:id,name,email,phone,status')
            ->orderBy('role')
            ->get();

        return response()->json(['data' => $users]);
    }

    public function store(Request $request)
    {
        $membership = $this->requireOwner($request);

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|max:255|unique:users,email',
            'phone' => 'nullable|string|max:50',
            'password' => 'required|string|min:8',
            'role' => 'required|in:staff,viewer',
        ]);

        $company = $membership->company;
        $plainPassword = $data['password'];
        $created = $this->companies->createCompanyUser($company, $data);

        try {
            $this->email->sendCompanyInvitation($created->user, $company, $plainPassword);
        } catch (\Throwable) {
            // Logged in email_logs.
        }

        return response()->json($created->load('user'), 201);
    }

    public function update(Request $request, CompanyUser $companyUser)
    {
        $membership = $this->requireOwner($request);

        if ($companyUser->company_id !== $membership->company_id) {
            abort(404);
        }

        if ($companyUser->role === CompanyUser::ROLE_OWNER && $companyUser->id !== $membership->id) {
            throw ValidationException::withMessages(['role' => ['Cannot modify another owner account.']]);
        }

        $data = $request->validate([
            'role' => 'sometimes|in:staff,viewer',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($companyUser->id === $membership->id && isset($data['is_active']) && ! $data['is_active']) {
            throw ValidationException::withMessages(['is_active' => ['You cannot deactivate your own account.']]);
        }

        $companyUser->update($data);

        return response()->json($companyUser->fresh()->load('user'));
    }

    public function destroy(Request $request, CompanyUser $companyUser)
    {
        $membership = $this->requireOwner($request);

        if ($companyUser->company_id !== $membership->company_id) {
            abort(404);
        }

        if ($companyUser->role === CompanyUser::ROLE_OWNER) {
            throw ValidationException::withMessages(['role' => ['Cannot remove the company owner.']]);
        }

        $user = $companyUser->user;
        if ($user && ($user->status ?? '') === 'active') {
            try {
                app(EmailService::class)->sendSystemAlert(
                    $user,
                    EmailType::ACCOUNT_DISABLED,
                    'Your Deliverex account has been deactivated',
                    ['message' => 'Your company team access has been removed by an administrator. Contact your company owner if you believe this is an error.'],
                );
            } catch (\Throwable) {
                // Non-blocking.
            }
        }

        $companyUser->delete();
        $user?->forceFill(['status' => 'inactive'])->save();

        return response()->json(['message' => 'Company user removed.']);
    }

    private function requireOwner(Request $request): CompanyUser
    {
        $membership = $request->user()?->companyUser;

        if (! $membership || ! $membership->isOwner() || ! $membership->is_active) {
            throw ValidationException::withMessages([
                'role' => ['Only an active company owner can manage users.'],
            ]);
        }

        return $membership->load('company');
    }
}
