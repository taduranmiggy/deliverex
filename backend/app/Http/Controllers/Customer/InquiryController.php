<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Inquiry;
use App\Models\JobOrder;
use App\Support\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class InquiryController extends Controller
{
    /** Public: customer submits a contact / delivery inquiry. */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name'              => 'required|string|max:120',
            'email'             => 'required|email|max:255',
            'phone'             => 'nullable|string|max:50',
            'pickup_location'   => 'nullable|string|max:255',
            'dropoff_location'  => 'nullable|string|max:255',
            'message'           => 'required|string|max:2000',
        ]);

        $inquiry = Inquiry::create($data);

        AuditLogger::record(null, 'inquiry.created', Inquiry::class, $inquiry->id, [
            'email' => $inquiry->email,
        ], $request);

        return response()->json([
            'message'    => 'Your inquiry has been received. A dispatcher will follow up shortly.',
            'inquiry_id' => $inquiry->id,
        ], 201);
    }

    /** Admin/Dispatcher: list all inquiries. */
    public function index(Request $request)
    {
        $status = $request->query('status'); // new | read | converted | all

        $query = Inquiry::orderByDesc('created_at');

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        return response()->json($query->paginate(25));
    }

    /** Admin/Dispatcher: view single inquiry. */
    public function show(Inquiry $inquiry)
    {
        return response()->json($inquiry->load('jobOrder'));
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
}
