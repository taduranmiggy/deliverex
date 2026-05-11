<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class InquiryController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'message' => 'required|string|max:500',
        ]);

        return response()->json([
            'message' => 'Your inquiry has been received. A response will be sent shortly.',
            'echo' => $data['message'],
        ], 201);
    }
}
