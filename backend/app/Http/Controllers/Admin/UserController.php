<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CompanyUser;
use App\Models\Role;
use App\Models\User;
use App\Services\Auth\UserInvitationService;
use App\Support\DriverAccount;
use App\Services\Company\CompanyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function __construct(
        private readonly CompanyService $companies,
        private readonly UserInvitationService $invites,
    ) {}

    public function index(Request $request)
    {
        $perPage = max(1, min(500, (int) $request->input('per_page', 6)));

        return response()->json(
            User::with('role', 'driver', 'companyUser.company')
                ->latest()
                ->paginate($perPage)
                ->through(fn (User $user) => $this->toPayload($user))
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'role_id' => 'required|exists:roles,id',
            'name' => 'required|string|max:120',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:30',
            'company_id' => 'nullable|exists:companies,id',
            'new_company' => 'nullable|array',
            'new_company.company_name' => 'required_without:company_id|nullable|string|max:180',
            'new_company.company_email' => 'required_without:company_id|nullable|email|max:255|unique:companies,company_email',
            'new_company.contact_person' => 'nullable|string|max:120',
            'new_company.contact_number' => 'nullable|string|max:50',
            'new_company.address' => 'nullable|string',
        ]);

        $role = Role::query()->findOrFail($data['role_id']);
        $this->assertSupportedRole($role->name);

        $isCustomer = $role->name === 'customer';
        $companyId = $data['company_id'] ?? null;

        if ($isCustomer && ! $companyId) {
            if (empty($data['new_company']['company_name']) || empty($data['new_company']['company_email'])) {
                throw ValidationException::withMessages([
                    'new_company.company_name' => ['Company details are required for Customer accounts.'],
                ]);
            }

            $company = $this->companies->createPendingCompany($data['new_company'], $request->user());
            $companyId = $company->id;
        }

        if ($isCustomer && ! $companyId) {
            throw ValidationException::withMessages([
                'company_id' => ['Company is required for Customer accounts.'],
            ]);
        }

        $user = User::create([
            'role_id' => $data['role_id'],
            'name' => $data['name'],
            'email' => strtolower(trim($data['email'])),
            'phone' => $data['phone'] ?? null,
            'password' => Hash::make(Str::random(40)),
            'status' => 'pending',
            'must_change_password' => true,
        ]);

        if ($isCustomer) {
            CompanyUser::query()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    'company_id' => (int) $companyId,
                    'role' => CompanyUser::ROLE_OWNER,
                    'is_active' => true,
                    'force_password_change' => true,
                ],
            );
        }

        $this->invites->sendInvitation($user->fresh());
        DriverAccount::sync($user->fresh());

        return response()->json($this->toPayload($user->fresh()->load('role', 'driver', 'companyUser.company')), 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'role_id' => 'sometimes|exists:roles,id',
            'name' => 'sometimes|string|max:120',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:8',
            'phone' => 'nullable|string|max:30',
            'status' => 'nullable|in:pending,active,inactive',
            'company_id' => 'nullable|exists:companies,id',
            'company_role' => 'nullable|in:owner,staff,viewer',
        ]);

        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
            $data['must_change_password'] = false;
        } else {
            unset($data['password']);
        }

        $nextRole = $user->role?->name;
        if (isset($data['role_id'])) {
            $role = Role::query()->findOrFail($data['role_id']);
            $this->assertSupportedRole($role->name);
            $nextRole = $role->name;
        }

        $user->update($data);

        if ($nextRole === 'customer') {
            $companyId = $data['company_id'] ?? $user->companyUser?->company_id;
            if (! $companyId) {
                throw ValidationException::withMessages([
                    'company_id' => ['Company is required for Customer accounts.'],
                ]);
            }

            CompanyUser::query()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    'company_id' => (int) $companyId,
                    'role' => $user->companyUser?->role ?? CompanyUser::ROLE_OWNER,
                    'is_active' => ($user->status ?? 'active') !== 'inactive',
                ],
            );
        }

        if (isset($data['status'])) {
            $this->companies->syncCustomerUserStatus($user->fresh());
        }

        if (isset($data['status']) && $data['status'] === 'inactive') {
            app(\App\Services\Auth\SessionService::class)->revokeAllForUser($user->id);
        }

        DriverAccount::sync($user->fresh());

        return response()->json($this->toPayload($user->fresh()->load('role', 'driver', 'companyUser.company')));
    }

    public function sendInvite(User $user)
    {
        if (($user->status ?? 'active') === 'inactive') {
            return response()->json(['message' => 'Cannot send invite for inactive users.'], 422);
        }

        $this->invites->sendInvitation($user);

        if (($user->status ?? 'active') !== 'active') {
            $user->forceFill(['status' => 'pending'])->save();
        }

        return response()->json([
            'message' => 'Invitation email sent.',
            'user' => $this->toPayload($user->fresh()->load('role', 'driver', 'companyUser.company')),
        ]);
    }

    public function destroy(User $user)
    {
        $user->delete();

        return response()->json(['message' => 'User deleted']);
    }

    private function assertSupportedRole(string $roleName): void
    {
        $allowed = ['admin', 'dispatcher', 'manager', 'driver', 'customer'];
        if (! in_array($roleName, $allowed, true)) {
            throw ValidationException::withMessages([
                'role_id' => ['Invalid role for admin user management.'],
            ]);
        }
    }

    private function toPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'status' => $user->status,
            'role_id' => $user->role_id,
            'role' => $user->role,
            'driver' => $user->driver,
            'company_id' => $user->companyUser?->company_id,
            'company_role' => $user->companyUser?->role,
            'company_name' => $user->companyUser?->company?->company_name,
            'invited_at' => $user->invited_at?->toIso8601String(),
            'invitation_accepted_at' => $user->invitation_accepted_at?->toIso8601String(),
            'can_send_invite' => ($user->status ?? 'active') !== 'active',
        ];
    }
}
