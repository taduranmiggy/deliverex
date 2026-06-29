<?php

namespace App\Http\Controllers;

use App\Services\Chatbot\ChatbotService;
use Illuminate\Http\Request;

class ChatbotController extends Controller
{
    public function __construct(private readonly ChatbotService $chatbot)
    {
    }

    /** Public + optional auth: intelligent assistant message. */
    public function message(Request $request)
    {
        $data = $request->validate([
            'message' => 'required|string|max:2000',
            'history' => 'nullable|array|max:20',
            'history.*.role' => 'required_with:history|string|in:user,assistant',
            'history.*.content' => 'required_with:history|string|max:2000',
            'state' => 'nullable|array',
            'session_id' => 'nullable|string|max:64',
        ]);

        $user = $request->user();
        $result = $this->chatbot->respond(
            $data['message'],
            $data['history'] ?? [],
            $user,
            $data['state'] ?? [],
        );

        $this->chatbot->recordInteraction(
            isset($result['matched_intent_id']) ? (int) $result['matched_intent_id'] : null,
            $data['message'],
            $user,
            (bool) ($result['resolved'] ?? true),
            $data['session_id'] ?? null,
        );

        return response()->json($result);
    }

    /** Public: welcome / capabilities without sending a user message. */
    public function welcome(Request $request)
    {
        return response()->json($this->chatbot->welcome($request->user()));
    }
}
