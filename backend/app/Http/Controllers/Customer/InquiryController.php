<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Inquiry;
use App\Models\JobOrder;
use App\Support\AuditLogger;
use App\Services\Inquiry\InquiryNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class InquiryController extends Controller
{
    public function __construct(private readonly InquiryNotificationService $notifications) {}

    /** Public: customer submits a contact / delivery inquiry. */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name'              => 'required|string|max:120',
            'email'             => 'required|email|max:255',
            'phone'             => ['nullable', 'string', 'regex:/^\+639\d{9}$/'],
            'inquiry_type'      => 'required|string|in:delivery_inquiry,complaint,follow_up,general_question,feedback',
            'subject'           => 'required|string|max:200',
            'reference_job_order_id' => 'nullable|integer|exists:job_orders,id',
            'message'           => 'required|string|max:2000',
        ], [
            'email.required' => 'Email is required.',
            'phone.regex' => 'Enter a valid Philippine mobile number (e.g. +639171234567).',
        ]);
        $data['email'] = Str::lower($data['email']);

        $customer = $request->user();
        if (! $customer && ! empty($data['reference_job_order_id'])) {
            return response()->json([
                'message' => 'Please sign in to attach a reference delivery.',
            ], 422);
        }

        if ($customer) {
            $data['name'] = $data['name'] ?: $customer->name;
            $data['email'] = strtolower($data['email'] ?: $customer->email);
            $data['phone'] = $data['phone'] ?: $customer->phone;

            if ($customer->role?->name === 'customer') {
                $data['customer_user_id'] = $customer->id;
            }

            if (! empty($data['reference_job_order_id'])) {
                $jobExistsForCustomer = JobOrder::query()
                    ->where('id', $data['reference_job_order_id'])
                    ->where('customer_user_id', $customer->id)
                    ->exists();

                if (! $jobExistsForCustomer) {
                    return response()->json([
                        'message' => 'Reference delivery is invalid for this account.',
                    ], 422);
                }
            }
        }

        $inquiry = Inquiry::create($data);
        $inquiry->update([
            'reference_no' => $this->buildReferenceNo($inquiry->id),
        ]);

        AuditLogger::record(null, 'inquiry.created', Inquiry::class, $inquiry->id, [
            'email' => $inquiry->email,
        ], $request);

        $notification = $this->notifications->notify($inquiry, 'public_form');

        return response()->json([
            'message'    => $notification['sent']
                ? 'Your concern has been submitted successfully. Our team will respond via email.'
                : 'Your concern has been saved. Email notification could not be sent.',
            'inquiry_id' => $inquiry->id,
            'reference_no' => $inquiry->reference_no,
            'email_notification_sent' => $notification['sent'],
        ], 201);
    }

    /** Authenticated customer: submit a concern linked to their account. */
    public function storeForCustomer(Request $request)
    {
        /** @var \App\Models\User $customer */
        $customer = $request->user();

        $data = $request->validate([
            'name'              => 'nullable|string|max:120',
            'email'             => 'nullable|email|max:255',
            'phone'             => ['nullable', 'string', 'regex:/^\+639\d{9}$/'],
            'inquiry_type'      => 'required|string|in:delivery_inquiry,complaint,follow_up,general_question,feedback',
            'subject'           => 'required|string|max:200',
            'reference_job_order_id' => 'nullable|integer|exists:job_orders,id',
            'message'           => 'required|string|max:2000',
        ], [
            'phone.regex' => 'Enter a valid Philippine mobile number (e.g. +639171234567).',
        ]);

        $data['name'] = trim($data['name'] ?? '') ?: $customer->name;
        $data['email'] = strtolower(trim($data['email'] ?? '') ?: $customer->email);
        $data['phone'] = $data['phone'] ?: $customer->phone;
        $data['customer_user_id'] = $customer->id;

        if (! empty($data['reference_job_order_id'])) {
            $jobExistsForCustomer = JobOrder::query()
                ->where('id', $data['reference_job_order_id'])
                ->where('customer_user_id', $customer->id)
                ->exists();

            if (! $jobExistsForCustomer) {
                return response()->json([
                    'message' => 'Reference delivery is invalid for this account.',
                ], 422);
            }
        }

        $inquiry = Inquiry::create($data);
        $inquiry->update([
            'reference_no' => $this->buildReferenceNo($inquiry->id),
        ]);

        AuditLogger::record($customer, 'inquiry.created', Inquiry::class, $inquiry->id, [
            'email' => $inquiry->email,
        ], $request);

        $notification = $this->notifications->notify($inquiry, 'customer_portal');

        return response()->json([
            'message'    => $notification['sent']
                ? 'Your feedback has been submitted. Our team will respond via email.'
                : 'Your feedback has been saved. Email notification could not be sent.',
            'inquiry_id' => $inquiry->id,
            'reference_no' => $inquiry->reference_no,
            'email_notification_sent' => $notification['sent'],
        ], 201);
    }

    /** Authenticated customer: list submitted concerns / feedback. */
    public function mine(Request $request)
    {
        /** @var \App\Models\User $customer */
        $customer = $request->user();
        $email = strtolower($customer->email);

        $query = Inquiry::query()
            ->where(function ($q) use ($customer, $email) {
                $q->where('customer_user_id', $customer->id)
                    ->orWhere(function ($q2) use ($email) {
                        $q2->whereNull('customer_user_id')
                            ->whereRaw('LOWER(email) = ?', [$email]);
                    });
            })
            ->orderByDesc('created_at');

        $perPage = max(1, min(50, (int) $request->query('per_page', 6)));

        $paginated = $query->paginate($perPage);

        $paginated->getCollection()->transform(function (Inquiry $inquiry) {
            return [
                'id' => $inquiry->id,
                'reference_no' => $inquiry->reference_no,
                'subject' => $inquiry->subject,
                'message' => $inquiry->message,
                'inquiry_type' => $inquiry->inquiry_type,
                'status' => $inquiry->status,
                'created_at' => $inquiry->created_at?->toIso8601String(),
            ];
        });

        return response()->json($paginated);
    }

    /** Admin/Dispatcher: list all inquiries. */
    public function index(Request $request)
    {
        $status = $request->query('status'); // new | read | converted | all

        $query = Inquiry::with(['jobOrder:id,tracking_code', 'referenceJobOrder:id,tracking_code'])
            ->orderByDesc('created_at');

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 6)));

        return response()->json($query->paginate($perPage));
    }

    /** Admin/Dispatcher: view single inquiry. */
    public function show(Inquiry $inquiry)
    {
        return response()->json($inquiry->load('jobOrder:id,tracking_code', 'referenceJobOrder:id,tracking_code'));
    }

    /** Admin/Dispatcher: mark inquiry as read. */
    public function markRead(Request $request, Inquiry $inquiry)
    {
        if ($inquiry->status === 'new') {
            $inquiry->update(['status' => 'read']);
        }

        return response()->json($inquiry);
    }

    /** Admin/Dispatcher: convert inquiry into a job order. */
    public function convert(Request $request, Inquiry $inquiry)
    {
        if ($inquiry->status === 'converted') {
            return response()->json(['message' => 'Already converted to a job order.'], 422);
        }

        $trackingCode = strtoupper(Str::random(10));

        $jobOrder = JobOrder::create([
            'created_by'         => $request->user()?->id,
            'customer_name'      => $inquiry->name,
            'customer_email'     => strtolower($inquiry->email),
            'customer_contact'   => $inquiry->phone,
            'pickup_location'    => $inquiry->pickup_location ?? '',
            'dropoff_location'   => $inquiry->dropoff_location ?? '',
            'job_requirements'   => $inquiry->message,
            'status'             => 'pending',
            'priority'           => 'normal',
            'tracking_code'      => $trackingCode,
        ]);

        $inquiry->update([
            'status'       => 'converted',
            'job_order_id' => $jobOrder->id,
        ]);

        AuditLogger::record($request->user(), 'inquiry.converted', Inquiry::class, $inquiry->id, [
            'job_order_id'   => $jobOrder->id,
            'tracking_code'  => $trackingCode,
        ], $request);

        return response()->json([
            'message'   => 'Inquiry converted to job order.',
            'job_order' => $jobOrder,
            'inquiry'   => $inquiry,
        ], 201);
    }

    /** Admin/Dispatcher: delete an inquiry. */
    public function destroy(Request $request, Inquiry $inquiry)
    {
        AuditLogger::record($request->user(), 'inquiry.deleted', Inquiry::class, $inquiry->id, [], $request);
        $inquiry->delete();

        return response()->json(['message' => 'Inquiry deleted.']);
    }

    private function buildReferenceNo(int $id): string
    {
        return 'INQ-'.now()->format('Y').'-'.str_pad((string) $id, 4, '0', STR_PAD_LEFT);
    }
}
