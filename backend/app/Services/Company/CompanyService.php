<?php

namespace App\Services\Company;

use App\Services\Email\EmailService;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use App\Services\Auth\SessionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class CompanyService
{
    public function __construct(
        private readonly SessionService $sessions,
        private readonly EmailService $email,
    ) {}

    public function createPendingCompany(array $data, User $admin): Company
    {
        $company = Company::query()->create([
            'company_name' => $data['company_name'],
            'company_email' => strtolower(trim($data['company_email'])),
            'contact_person' => $data['contact_person'] ?? null,
            'contact_number' => $data['contact_number'] ?? null,
            'address' => $data['address'] ?? null,
            'status' => Company::STATUS_PENDING,
            'created_by' => $admin->id,
        ]);

        $token = $company->issueActivationToken(72);
        $this->sendActivationEmail($company, $token);

        return $company->fresh();
    }

    public function resendActivation(Company $company): void
    {
        if ($company->status !== Company::STATUS_PENDING) {
            throw ValidationException::withMessages([
                'status' => ['Company is not pending activation.'],
            ]);
        }

        $token = $company->issueActivationToken(72);
        $this->sendActivationEmail($company, $token);
    }

    public function validateActivationToken(string $token): Company
    {
        $company = Company::query()->where('activation_token', $token)->first();

        if (! $company) {
            throw ValidationException::withMessages(['token' => ['Invalid activation link.']]);
        }

        if ($company->status !== Company::STATUS_PENDING) {
            throw ValidationException::withMessages(['token' => ['Company account is already activated.']]);
        }

        if ($company->activation_expires_at && $company->activation_expires_at->isPast()) {
            throw ValidationException::withMessages(['token' => ['Activation link has expired. Contact your administrator.']]);
        }

        return $company;
    }

    public function activateCompany(Company $company, string $password, Request $request): array
    {
        return DB::transaction(function () use ($company, $password, $request) {
            $email = strtolower(trim($company->company_email));
            $role = Role::query()->where('name', 'customer')->firstOrFail();

            $user = User::query()->where('email', $email)->first();

            if ($user) {
                $user->forceFill([
                    'name' => $company->contact_person ?: $company->company_name,
                    'password' => $password,
                    'status' => 'active',
                    'email_verified_at' => now(),
                ])->save();
            } else {
                $user = User::query()->create([
                    'role_id' => $role->id,
                    'name' => $company->contact_person ?: $company->company_name,
                    'email' => $email,
                    'phone' => $company->contact_number,
                    'password' => $password,
                    'status' => 'active',
                    'email_verified_at' => now(),
                ]);
            }

            CompanyUser::query()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    'company_id' => $company->id,
                    'role' => CompanyUser::ROLE_OWNER,
                    'is_active' => true,
                    'force_password_change' => false,
                ],
            );

            $company->forceFill(['status' => Company::STATUS_ACTIVE])->save();
            $company->clearActivationToken();

            $this->linkJobOrdersToCompany($company);
            $this->linkJobOrdersToUser($user, $company);

            $issued = $this->sessions->createSession($user, $request);
            $user->load(['role', 'companyUser.company']);

            return [
                'token' => $issued['access_token'],
                'access_token' => $issued['access_token'],
                'expires_in' => $issued['expires_in'],
                'session_id' => $issued['session_id'],
                'refresh_token' => $issued['refresh_token'],
                'user' => $user,
            ];
        });
    }

    public function createCompanyUser(Company $company, array $data): CompanyUser
    {
        $role = Role::query()->where('name', 'customer')->firstOrFail();
        $email = strtolower(trim($data['email']));

        $user = User::query()->create([
            'role_id' => $role->id,
            'name' => $data['name'],
            'email' => $email,
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'],
            'status' => 'active',
            'email_verified_at' => now(),
            'must_change_password' => true,
        ]);

        return CompanyUser::query()->create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'role' => $data['role'] ?? CompanyUser::ROLE_STAFF,
            'is_active' => true,
            'force_password_change' => true,
        ]);
    }

    public function linkJobOrdersToCompany(Company $company): int
    {
        return JobOrder::query()
            ->where(function ($q) use ($company) {
                $q->whereNull('company_id')
                    ->orWhere('company_id', '!=', $company->id);
            })
            ->whereRaw('LOWER(customer_email) = ?', [strtolower(trim($company->company_email))])
            ->update(['company_id' => $company->id]);
    }

    public function linkJobOrdersToUser(User $user, Company $company): int
    {
        return JobOrder::query()
            ->where('company_id', $company->id)
            ->update(['customer_user_id' => $user->id]);
    }

    public function resolveCustomerUserIdForCompany(Company $company): ?int
    {
        return CompanyUser::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderByRaw("CASE role WHEN 'owner' THEN 0 WHEN 'staff' THEN 1 ELSE 2 END")
            ->value('user_id');
    }

    private function sendActivationEmail(Company $company, string $token): void
    {
        $url = rtrim(config('app.frontend_url', config('app.url')), '/').'/activate-company/'.$token;

        try {
            $this->email->sendCompanyActivation($company, $url);
        } catch (\Throwable) {
            // Logged by EmailService / ResendService; do not block company creation.
        }
    }
}
