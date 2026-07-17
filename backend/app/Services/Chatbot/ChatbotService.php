<?php

namespace App\Services\Chatbot;

use App\Models\ChatbotIntent;
use App\Models\ChatbotInteraction;
use App\Models\Inquiry;
use App\Models\JobOrder;
use App\Models\User;
use App\Services\Delivery\EtaEstimationService;
use App\Services\Inquiry\InquiryNotificationService;
use App\Support\AuditLogger;
use App\Support\DeliveryStatus;
use Illuminate\Support\Str;

class ChatbotService
{
    public function __construct(
        private readonly EtaEstimationService $etaEstimation,
        private readonly InquiryNotificationService $inquiryNotifications,
    ) {
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     * @param  array<string, mixed>  $state
     * @return array{
     *   messages: array<int, array{type: string, body: mixed}>,
     *   suggestions: array<int, string>,
     *   state: array<string, mixed>,
     *   typing_label: string
     * }
     */
    public function respond(string $message, array $history = [], ?User $user = null, array $state = []): array
    {
        $trimmed = trim($message);
        $normalized = $this->normalize($trimmed);

        if ($trimmed === '') {
            return $this->welcome($user);
        }

        if ($this->isMenuReset($normalized)) {
            return $this->welcome($user);
        }

        $mode = (string) ($state['mode'] ?? '');

        if ($mode === 'tracking') {
            return $this->handleTrackingInput($trimmed, $user);
        }

        if ($mode === 'inquiry') {
            return $this->handleInquiryStep($trimmed, $state, $user);
        }

        if ($code = $this->extractTrackingCode($trimmed)) {
            return $this->lookupTracking($code, $user);
        }

        if ($this->isQuickAction($normalized, 'track my delivery', 'track delivery', 'track another delivery', 'track again')) {
            return $this->startTracking();
        }

        if ($this->isQuickAction($normalized, 'submit a concern', 'submit concern', 'file concern', 'mag reklamo')) {
            return $this->startInquiry($trimmed, $user, $state);
        }

        if ($this->isQuickAction($normalized, 'delivery status guide', 'status guide', 'faqs', 'faq')) {
            return $this->statusGuideResponse();
        }

        if ($this->isQuickAction($normalized, 'account help', 'login', 'link delivery', 'forgot password')) {
            return $this->accountHelpResponse($normalized);
        }

        if ($this->isQuickAction($normalized, 'contact support', 'contact')) {
            return $this->contactResponse();
        }

        if ($this->isQuickAction($normalized, 'what is deliverex', 'about deliverex')) {
            return $this->knowledgeResponse('overview');
        }

        $dbIntent = $this->matchDbIntent($normalized);
        if ($dbIntent) {
            return $this->dbIntentResponse($dbIntent);
        }

        if ($this->looksLikeTrackingIntent($normalized)) {
            return $this->startTracking();
        }

        if ($this->looksLikeInquiryIntent($normalized)) {
            return $this->startInquiry($trimmed, $user, $state);
        }

        if ($this->looksLikeContactIntent($normalized)) {
            return $this->contactResponse();
        }

        if ($this->looksLikeAccountIntent($normalized)) {
            return $this->accountHelpResponse($normalized);
        }

        $topic = $this->matchKnowledge($normalized, $history);
        if ($topic !== null) {
            return $this->knowledgeResponse($topic, $user);
        }

        return $this->fallbackResponse($trimmed, $user);
    }

    /** @return array<string, mixed> */
    public function welcome(?User $user = null): array
    {
        $name = $user?->name ? explode(' ', trim($user->name))[0] : null;
        $greeting = $name ? "Hello {$name}!" : 'Hello!';

        $text = "{$greeting} I'm the Deliverex Assistant — ask me anything about deliveries, tracking, accounts, concerns, or how our system works.\n\n"
            . "Examples:\n"
            . "• \"Where is TRK-ABC123?\"\n"
            . "• \"How do I submit a complaint?\"\n"
            . "• \"What does Best-Fit assignment mean?\"\n"
            . "• \"Paano mag-track ng padala?\"\n\n"
            . 'Type a question or pick an option below.';

        return [
            'messages' => [['type' => 'text', 'body' => $text]],
            'suggestions' => config('chatbot.suggestions.default', []),
            'state' => ['mode' => null],
            'typing_label' => 'Thinking...',
        ];
    }

    /** @return array<string, mixed> */
    private function startTracking(): array
    {
        return [
            'messages' => [[
                'type' => 'text',
                'body' => "Please enter your Tracking ID.\n\nExamples:\nTRK-ABC123\nDLX-2026-001",
            ]],
            'suggestions' => config('chatbot.suggestions.after_track', []),
            'state' => ['mode' => 'tracking'],
            'typing_label' => 'Checking delivery details...',
        ];
    }

    /** @return array<string, mixed> */
    private function handleTrackingInput(string $code, ?User $user): array
    {
        return $this->lookupTracking($code, $user);
    }

    /** @return array<string, mixed> */
    private function lookupTracking(string $rawCode, ?User $user): array
    {
        $normalized = strtoupper(trim($rawCode));

        if (str_starts_with($normalized, 'DEMO-')) {
            return [
                'messages' => [[
                    'type' => 'text',
                    'body' => 'That Tracking ID was not found. Please check the code and try again.',
                ]],
                'suggestions' => config('chatbot.suggestions.after_track', []),
                'state' => ['mode' => 'tracking'],
                'typing_label' => 'Checking delivery details...',
            ];
        }

        $jobOrder = JobOrder::query()
            ->where('tracking_code', $normalized)
            ->first();

        if (! $jobOrder) {
            return [
                'messages' => [[
                    'type' => 'text',
                    'body' => "I couldn't find a delivery with Tracking ID {$normalized}.\n\nDouble-check SMS/email from your dispatcher, or contact support if you believe this is an error.",
                ]],
                'suggestions' => config('chatbot.suggestions.after_track', []),
                'state' => ['mode' => null],
                'typing_label' => 'Checking delivery details...',
            ];
        }

        $latestAssignment = $jobOrder->assignments()
            ->latest('assigned_at')
            ->with(['deliveryStatusLogs', 'trackingLogs'])
            ->first();

        $latestStatus = $latestAssignment?->deliveryStatusLogs()
            ->orderByDesc('created_at')
            ->first();

        $latestTracking = $latestAssignment?->trackingLogs()
            ->orderByDesc('captured_at')
            ->first();

        $rawCurrent = $latestStatus?->status ?? $jobOrder->status;
        if (! $latestAssignment && in_array(strtolower((string) $jobOrder->status), ['pending', ''], true)) {
            $currentStatus = 'pending';
        } else {
            $currentStatus = DeliveryStatus::canonicalize($rawCurrent) ?? $rawCurrent;
        }

        $statusLabel = DeliveryStatus::label($currentStatus) ?? ucfirst(str_replace('_', ' ', (string) $currentStatus));

        $lastEventAt = $latestStatus?->created_at?->timezone(config('app.timezone'))->format('M j, Y g:i A');
        $eta = $this->etaEstimation->estimate($jobOrder, $latestTracking, (string) $currentStatus);

        $messages = [[
            'type' => 'tracking',
            'body' => [
                'code' => $jobOrder->tracking_code,
                'status' => $statusLabel,
                'last_updated' => $lastEventAt ?? 'Not yet available',
                'eta' => is_string($eta) ? $eta : ($eta['label'] ?? null),
                'tracking_link' => '/customer/track',
            ],
        ]];

        if ($user && $user->role?->name === 'customer') {
            $messages[] = [
                'type' => 'text',
                'body' => 'Open the tracking page for the full timeline and proof of delivery when available.',
            ];
        }

        return [
            'messages' => $messages,
            'suggestions' => config('chatbot.suggestions.after_track', []),
            'state' => ['mode' => null],
            'typing_label' => 'Checking delivery details...',
        ];
    }

    /**
     * @param  array<string, mixed>  $state
     * @return array<string, mixed>
     */
    private function startInquiry(string $message, ?User $user, array $state): array
    {
        $draft = (array) ($state['inquiry'] ?? []);
        $draft['message'] = $draft['message'] ?? $this->inferInquiryMessage($message);
        $draft['inquiry_type'] = $draft['inquiry_type'] ?? $this->inferInquiryType($message);
        $draft['subject'] = $draft['subject'] ?? $this->inferInquirySubject($message, $draft['inquiry_type']);

        if ($user) {
            $draft['name'] = $user->name;
            $draft['email'] = strtolower($user->email);
            $draft['phone'] = $user->phone;
        }

        $step = $this->nextInquiryStep($draft, $user);

        if ($step === 'confirm') {
            return $this->inquiryConfirmResponse($draft);
        }

        return $this->inquiryPromptForStep($step, $draft);
    }

    /**
     * @param  array<string, mixed>  $state
     * @return array<string, mixed>
     */
    private function handleInquiryStep(string $message, array $state, ?User $user): array
    {
        $draft = (array) ($state['inquiry'] ?? []);
        $step = (string) ($state['inquiry_step'] ?? 'message');

        if ($this->isCancellation($message)) {
            return [
                'messages' => [[
                    'type' => 'text',
                    'body' => 'Concern submission cancelled. How else can I help?',
                ]],
                'suggestions' => config('chatbot.suggestions.default', []),
                'state' => ['mode' => null],
                'typing_label' => 'Thinking...',
            ];
        }

        if ($step === 'confirm' && $this->isAffirmative($message)) {
            return $this->submitInquiry($draft, $user);
        }

        if ($step === 'confirm') {
            return $this->inquiryPromptForStep('message', $draft);
        }

        $field = $step;
        $value = trim($message);

        if ($field === 'email') {
            $value = strtolower($value);
            if (! filter_var($value, FILTER_VALIDATE_EMAIL)) {
                return [
                    'messages' => [[
                        'type' => 'text',
                        'body' => 'Please enter a valid email address (e.g. you@company.com).',
                    ]],
                    'suggestions' => ['Cancel'],
                    'state' => ['mode' => 'inquiry', 'inquiry' => $draft, 'inquiry_step' => 'email'],
                    'typing_label' => 'Thinking...',
                ];
            }
        }

        if ($field === 'phone' && $value !== '' && $value !== 'skip') {
            if (! preg_match('/^\+639\d{9}$/', $value)) {
                return [
                    'messages' => [[
                        'type' => 'text',
                        'body' => 'Enter a valid Philippine mobile number (e.g. +639171234567) or type "skip".',
                    ]],
                    'suggestions' => ['Skip'],
                    'state' => ['mode' => 'inquiry', 'inquiry' => $draft, 'inquiry_step' => 'phone'],
                    'typing_label' => 'Thinking...',
                ];
            }
        }

        if ($field === 'phone' && ($value === '' || strtolower($value) === 'skip')) {
            $value = null;
        }

        $draft[$field] = $value;
        $next = $this->nextInquiryStep($draft, $user);

        if ($next === 'confirm') {
            return $this->inquiryConfirmResponse($draft);
        }

        return $this->inquiryPromptForStep($next, $draft);
    }

    /** @param  array<string, mixed>  $draft */
    private function nextInquiryStep(array $draft, ?User $user): string
    {
        if (empty($draft['message'])) {
            return 'message';
        }
        if (empty($draft['subject'])) {
            return 'subject';
        }
        if (empty($draft['name']) && ! $user) {
            return 'name';
        }
        if (empty($draft['email']) && ! $user) {
            return 'email';
        }
        if (! array_key_exists('phone', $draft) && ! $user?->phone) {
            return 'phone';
        }

        return 'confirm';
    }

    /** @param  array<string, mixed>  $draft */
    private function inquiryPromptForStep(string $step, array $draft): array
    {
        $prompts = [
            'message' => 'Describe your concern in detail (what happened, Tracking ID if any, dates).',
            'subject' => 'Give a short subject line for your concern (max 200 characters).',
            'name' => 'What is your full name?',
            'email' => 'What email should we use to reply?',
            'phone' => 'Optional: Philippine mobile for callbacks (e.g. +639171234567), or type "skip".',
        ];

        $messages = [];

        if ($step !== 'message' && ! empty($draft['message'])) {
            $messages[] = [
                'type' => 'text',
                'body' => "Got it. I'll help you submit this concern to our team.",
            ];
        } else {
            $messages[] = [
                'type' => 'text',
                'body' => "I'll help you submit a concern to our support team. {$prompts[$step]}",
            ];
        }

        $messages[] = [
            'type' => 'text',
            'body' => $prompts[$step],
        ];

        $suggestions = $step === 'phone' ? ['Skip', 'Cancel'] : ['Cancel'];

        return [
            'messages' => $messages,
            'suggestions' => $suggestions,
            'state' => [
                'mode' => 'inquiry',
                'inquiry' => $draft,
                'inquiry_step' => $step,
            ],
            'typing_label' => 'Thinking...',
        ];
    }

    /** @param  array<string, mixed>  $draft */
    private function inquiryConfirmResponse(array $draft): array
    {
        $typeLabels = [
            'delivery_inquiry' => 'Delivery concern',
            'complaint' => 'Complaint',
            'follow_up' => 'Follow-up',
            'general_question' => 'General question',
            'feedback' => 'Feedback',
        ];
        $type = $typeLabels[$draft['inquiry_type'] ?? 'general_question'] ?? 'General question';

        $summary = "Please confirm your concern:\n\n"
            . "Type: {$type}\n"
            . 'Subject: '.($draft['subject'] ?? '')."\n"
            . 'Name: '.($draft['name'] ?? '')."\n"
            . 'Email: '.($draft['email'] ?? '')."\n"
            . 'Phone: '.($draft['phone'] ?? '—')."\n\n"
            . 'Message: '.($draft['message'] ?? '')."\n\n"
            . 'Reply yes to submit, or cancel to stop.';

        return [
            'messages' => [['type' => 'text', 'body' => $summary]],
            'suggestions' => ['Yes, submit', 'Cancel'],
            'state' => [
                'mode' => 'inquiry',
                'inquiry' => $draft,
                'inquiry_step' => 'confirm',
            ],
            'typing_label' => 'Submitting concern...',
        ];
    }

    /** @param  array<string, mixed>  $draft */
    private function submitInquiry(array $draft, ?User $user): array
    {
        $payload = [
            'name' => (string) ($draft['name'] ?? ''),
            'email' => strtolower((string) ($draft['email'] ?? '')),
            'phone' => $draft['phone'] ?? null,
            'inquiry_type' => $draft['inquiry_type'] ?? 'general_question',
            'subject' => (string) ($draft['subject'] ?? 'Customer concern'),
            'message' => (string) ($draft['message'] ?? ''),
        ];

        if ($user && $user->role?->name === 'customer') {
            $payload['customer_user_id'] = $user->id;
        }

        $inquiry = Inquiry::create($payload);
        $referenceNo = 'INQ-'.now()->format('Y').'-'.str_pad((string) $inquiry->id, 4, '0', STR_PAD_LEFT);
        $inquiry->update(['reference_no' => $referenceNo]);

        AuditLogger::record($user, 'inquiry.created', Inquiry::class, $inquiry->id, [
            'email' => $inquiry->email,
            'source' => 'chatbot',
        ]);

        $notification = $this->inquiryNotifications->notify($inquiry, 'chatbot');

        $successMessage = "Your concern has been submitted successfully.\n\nReference: {$referenceNo}\n\nOur team will respond via email.";
        if (! $notification['sent']) {
            $successMessage .= "\n\nNote: We saved your concern but could not send the email notification to our team. Please contact support directly if you do not hear back.";
        }

        return [
            'messages' => [[
                'type' => 'inquiry_submitted',
                'body' => [
                    'reference_no' => $referenceNo,
                    'message' => $successMessage,
                    'email_notification_sent' => $notification['sent'],
                ],
            ]],
            'email_notification_sent' => $notification['sent'],
            'suggestions' => config('chatbot.suggestions.after_answer', []),
            'state' => ['mode' => null],
            'typing_label' => 'Submitting concern...',
        ];
    }

    /** @return array<string, mixed> */
    private function knowledgeResponse(string $topic, ?User $user = null): array
    {
        $article = config("chatbot.knowledge.{$topic}");
        $answer = is_array($article) ? ($article['answer'] ?? '') : '';

        return [
            'messages' => [['type' => 'text', 'body' => $answer]],
            'suggestions' => config('chatbot.suggestions.after_answer', []),
            'state' => ['mode' => null],
            'typing_label' => 'Thinking...',
        ];
    }

    /** @return array<string, mixed> */
    private function statusGuideResponse(): array
    {
        return [
            'messages' => [
                ['type' => 'status_guide', 'body' => null],
                ['type' => 'faq', 'body' => null],
            ],
            'suggestions' => config('chatbot.suggestions.after_answer', []),
            'state' => ['mode' => null],
            'typing_label' => 'Thinking...',
        ];
    }

    /** @return array<string, mixed> */
    private function accountHelpResponse(string $normalized): array
    {
        $messages = [];

        if (str_contains($normalized, 'login') || str_contains($normalized, 'sign in')) {
            $messages[] = ['type' => 'text', 'body' => config('chatbot.knowledge.account_login.answer')];
            $messages[] = ['type' => 'link', 'body' => ['text' => 'Customer Login', 'href' => '/customer/login']];
        } elseif (str_contains($normalized, 'link')) {
            $messages[] = ['type' => 'text', 'body' => config('chatbot.knowledge.link_delivery.answer')];
            $messages[] = ['type' => 'link', 'body' => ['text' => 'Link Delivery', 'href' => '/customer/link-delivery']];
        } elseif (str_contains($normalized, 'password') || str_contains($normalized, 'forgot')) {
            $messages[] = ['type' => 'text', 'body' => config('chatbot.knowledge.forgot_password.answer')];
            $messages[] = ['type' => 'link', 'body' => ['text' => 'Forgot Password', 'href' => '/customer/forgot-password']];
        } else {
            $messages[] = ['type' => 'text', 'body' => 'Choose a topic: Login, Link Delivery, or Forgot Password.'];
            $messages[] = ['type' => 'link', 'body' => ['text' => 'Customer Login', 'href' => '/customer/login']];
            $messages[] = ['type' => 'link', 'body' => ['text' => 'Link Delivery', 'href' => '/customer/link-delivery']];
            $messages[] = ['type' => 'link', 'body' => ['text' => 'Forgot Password', 'href' => '/customer/forgot-password']];
        }

        return [
            'messages' => $messages,
            'suggestions' => config('chatbot.suggestions.after_answer', []),
            'state' => ['mode' => null],
            'typing_label' => 'Thinking...',
        ];
    }

    /** @return array<string, mixed> */
    private function contactResponse(): array
    {
        return $this->withIntentMeta([
            'messages' => [
                ['type' => 'text', 'body' => 'You can reach our support team through these channels:'],
                ['type' => 'contact', 'body' => [
                    'email' => config('chatbot.support_email'),
                    'phone' => config('chatbot.support_phone'),
                ]],
            ],
            'suggestions' => ['Submit Concern', 'Track Delivery', 'Menu'],
            'state' => ['mode' => null],
            'typing_label' => 'Thinking...',
        ], null, true);
    }

    public function recordInteraction(
        ?int $intentId,
        string $message,
        ?User $user,
        bool $resolved,
        ?string $sessionId = null,
    ): void {
        ChatbotInteraction::query()->create([
            'intent_id' => $intentId,
            'session_id' => $sessionId,
            'user_message' => Str::limit($message, 2000),
            'resolved' => $resolved,
            'user_id' => $user?->id,
        ]);

        if ($intentId) {
            ChatbotIntent::query()->whereKey($intentId)->increment('hit_count');
            if ($resolved) {
                ChatbotIntent::query()->whereKey($intentId)->increment('resolved_count');
            }
        }
    }

    /** @return array<string, mixed> */
    private function dbIntentResponse(ChatbotIntent $intent): array
    {
        return $this->withIntentMeta([
            'messages' => [['type' => 'text', 'body' => $intent->answer]],
            'suggestions' => config('chatbot.suggestions.after_answer', []),
            'state' => ['mode' => null],
            'typing_label' => 'Thinking...',
        ], $intent->id, true);
    }

    /** @param  array<string, mixed>  $result */
    private function withIntentMeta(array $result, ?int $intentId, bool $resolved): array
    {
        $result['matched_intent_id'] = $intentId;
        $result['resolved'] = $resolved;

        return $result;
    }

    private function matchDbIntent(string $normalized): ?ChatbotIntent
    {
        $intents = ChatbotIntent::query()->where('is_active', true)->orderBy('name')->get();
        $best = null;
        $bestScore = 0;

        foreach ($intents as $intent) {
            $score = 0;
            foreach ($intent->keywords ?? [] as $keyword => $weight) {
                $needle = $this->normalize((string) $keyword);
                if ($needle !== '' && str_contains($normalized, $needle)) {
                    $score += (int) $weight;
                }
            }
            foreach ($intent->training_phrases ?? [] as $phrase) {
                $needle = $this->normalize((string) $phrase);
                if ($needle !== '' && str_contains($normalized, $needle)) {
                    $score += 4;
                }
            }
            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $intent;
            }
        }

        return $bestScore >= 3 ? $best : null;
    }

    /** @return array<string, mixed> */
    private function fallbackResponse(string $message, ?User $user): array
    {
        $phone = config('chatbot.support_phone');
        $email = config('chatbot.support_email');
        $text = "I'm sorry, I could not find an answer to that. Please contact "
            .config('chatbot.company_name')
            ." directly at {$phone} or {$email} for further assistance.";

        return $this->withIntentMeta([
            'messages' => [['type' => 'text', 'body' => $text]],
            'suggestions' => config('chatbot.suggestions.default', []),
            'state' => ['mode' => null],
            'typing_label' => 'Thinking...',
        ], null, false);
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     */
    private function matchKnowledge(string $normalized, array $history): ?string
    {
        $knowledge = config('chatbot.knowledge', []);
        $bestTopic = null;
        $bestScore = 0;

        foreach ($knowledge as $topic => $article) {
            $score = 0;
            foreach ($article['keywords'] ?? [] as $keyword => $weight) {
                if (str_contains($normalized, $this->normalize($keyword))) {
                    $score += (int) $weight;
                }
            }
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestTopic = $topic;
            }
        }

        return $bestScore >= 2 ? $bestTopic : null;
    }

    private function extractTrackingCode(string $message): ?string
    {
        if (preg_match('/\b((?:TRK|DLX)-[A-Z0-9-]{4,})\b/i', $message, $m)) {
            return strtoupper($m[1]);
        }

        if (preg_match('/\b([A-Z]{2,5}-\d{4}-\d{3,})\b/i', $message, $m)) {
            return strtoupper($m[1]);
        }

        return null;
    }

    private function inferInquiryType(string $message): string
    {
        $n = $this->normalize($message);
        if (preg_match('/\b(reklamo|complaint|problema|issue|late|delay)\b/', $n)) {
            return 'complaint';
        }
        if (preg_match('/\b(feedback|suggestion|salamat|thanks)\b/', $n)) {
            return 'feedback';
        }
        if (preg_match('/\b(follow.?up|followup|update on)\b/', $n)) {
            return 'follow_up';
        }
        if (preg_match('/\b(delivery|track|shipment|padala)\b/', $n)) {
            return 'delivery_inquiry';
        }

        return 'general_question';
    }

    private function inferInquirySubject(string $message, string $type): string
    {
        $trimmed = Str::limit(trim($message), 120, '');
        if (strlen($trimmed) >= 8 && ! in_array(strtolower($trimmed), ['submit a concern', 'submit concern', 'mag reklamo'], true)) {
            return $trimmed;
        }

        return match ($type) {
            'complaint' => 'Customer complaint',
            'feedback' => 'Customer feedback',
            'delivery_inquiry' => 'Delivery inquiry',
            'follow_up' => 'Follow-up on previous concern',
            default => 'General question',
        };
    }

    private function inferInquiryMessage(string $message): ?string
    {
        $lower = strtolower(trim($message));
        $triggers = ['submit a concern', 'submit concern', 'file concern', 'mag reklamo', 'reklamo', 'complaint'];

        foreach ($triggers as $trigger) {
            if ($lower === $trigger || str_starts_with($lower, $trigger.' ')) {
                return null;
            }
        }

        if (strlen(trim($message)) > 20) {
            return trim($message);
        }

        return null;
    }

    private function normalize(string $text): string
    {
        $text = mb_strtolower($text);
        $text = preg_replace('/[^\p{L}\p{N}\s-]/u', ' ', $text) ?? $text;

        return preg_replace('/\s+/', ' ', trim($text)) ?? '';
    }

    private function isMenuReset(string $normalized): bool
    {
        return in_array($normalized, ['return to menu', 'menu', 'start over', 'reset', 'help', 'main menu'], true);
    }

    private function isQuickAction(string $normalized, string ...$phrases): bool
    {
        foreach ($phrases as $phrase) {
            if ($normalized === $this->normalize($phrase)) {
                return true;
            }
        }

        return false;
    }

    private function looksLikeTrackingIntent(string $normalized): bool
    {
        if (preg_match('/\b(tracking id|tracking code|where is my tracking)\b/', $normalized)) {
            return false;
        }

        return (bool) preg_match('/\b(track my delivery|track delivery|track|tracking|saan|nasaan|status ng padala|where is my delivery|where is my package)\b/', $normalized);
    }

    private function looksLikeInquiryIntent(string $normalized): bool
    {
        return (bool) preg_match('/\b(inquiry|concern|complaint|reklamo|feedback|report problem|file concern|mag reklamo)\b/', $normalized);
    }

    private function looksLikeContactIntent(string $normalized): bool
    {
        return (bool) preg_match('/\b(contact|support|tawag|email support|call)\b/', $normalized);
    }

    private function looksLikeAccountIntent(string $normalized): bool
    {
        return (bool) preg_match('/\b(account|login|password|sign in|link delivery|forgot)\b/', $normalized);
    }

    private function isAffirmative(string $message): bool
    {
        $n = $this->normalize($message);

        return in_array($n, ['yes', 'yes submit', 'oo', 'sige', 'confirm', 'submit', 'ok', 'okay'], true)
            || str_starts_with($n, 'yes');
    }

    private function isCancellation(string $message): bool
    {
        $n = $this->normalize($message);

        return in_array($n, ['cancel', 'stop', 'never mind', 'nevermind', 'hindi na'], true);
    }
}
