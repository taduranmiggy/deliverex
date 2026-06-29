<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ChatbotIntent;
use App\Models\ChatbotInteraction;
use App\Support\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ChatbotIntentController extends Controller
{
    public function index(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $since = now()->subDays(7);

        $query = ChatbotIntent::query()->orderBy('name');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $intents = $query->get()->map(fn (ChatbotIntent $intent) => $this->toPayload($intent, $since));

        return response()->json(['data' => $intents]);
    }

    public function show(ChatbotIntent $chatbotIntent)
    {
        return response()->json($this->toPayload($chatbotIntent, now()->subDays(7), true));
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $intent = ChatbotIntent::create($data);

        AuditLogger::record($request->user(), 'chatbot_intent.created', ChatbotIntent::class, $intent->id, [
            'slug' => $intent->slug,
        ], $request);

        return response()->json($this->toPayload($intent, now()->subDays(7), true), 201);
    }

    public function update(Request $request, ChatbotIntent $chatbotIntent)
    {
        $data = $this->validated($request, $chatbotIntent->id);

        $chatbotIntent->update($data);

        AuditLogger::record($request->user(), 'chatbot_intent.updated', ChatbotIntent::class, $chatbotIntent->id, [
            'slug' => $chatbotIntent->slug,
        ], $request);

        return response()->json($this->toPayload($chatbotIntent->fresh(), now()->subDays(7), true));
    }

    public function destroy(Request $request, ChatbotIntent $chatbotIntent)
    {
        AuditLogger::record($request->user(), 'chatbot_intent.deleted', ChatbotIntent::class, $chatbotIntent->id, [
            'slug' => $chatbotIntent->slug,
        ], $request);

        $chatbotIntent->delete();

        return response()->json(['message' => 'Intent deleted.']);
    }

    public function stats()
    {
        $since = now()->subDays(7);
        $today = now()->startOfDay();

        $interactionsToday = ChatbotInteraction::query()->where('created_at', '>=', $today)->count();
        $interactionsWeek = ChatbotInteraction::query()->where('created_at', '>=', $since)->count();
        $resolvedWeek = ChatbotInteraction::query()
            ->where('created_at', '>=', $since)
            ->where('resolved', true)
            ->count();

        $resolutionRate = $interactionsWeek > 0
            ? (int) round(($resolvedWeek / $interactionsWeek) * 100)
            : 0;

        $topIntents = ChatbotIntent::query()
            ->withCount(['interactions as hits_7d' => fn ($q) => $q->where('created_at', '>=', $since)])
            ->orderByDesc('hits_7d')
            ->limit(5)
            ->get()
            ->map(fn (ChatbotIntent $intent) => [
                'intent' => $intent->name,
                'volume' => (int) $intent->hits_7d,
                'rate' => $this->resolutionRateForIntent($intent->id, $since),
                'updated' => $intent->updated_at?->format('Y-m-d'),
            ]);

        return response()->json([
            'sessions_today' => $interactionsToday,
            'resolution_rate' => $resolutionRate,
            'interactions_7d' => $interactionsWeek,
            'top_intents' => $topIntents,
        ]);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'slug' => [
                'nullable',
                'string',
                'max:80',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('chatbot_intents', 'slug')->ignore($ignoreId),
            ],
            'description' => 'nullable|string|max:500',
            'answer' => 'required|string|max:5000',
            'owner' => 'nullable|string|max:120',
            'keywords' => 'nullable|array',
            'keywords.*' => 'nullable',
            'training_phrases' => 'required|array|min:1',
            'training_phrases.*' => 'required|string|max:200',
            'is_active' => 'sometimes|boolean',
        ], [
            'training_phrases.required' => 'Add at least one training phrase.',
            'training_phrases.min' => 'Add at least one training phrase.',
            'slug.regex' => 'Slug may only contain lowercase letters, numbers, and underscores.',
        ]);

        $slug = trim((string) ($data['slug'] ?? ''));
        if ($slug === '') {
            $slug = Str::slug($data['name'], '_');
        }

        $data['slug'] = $slug;
        $data['keywords'] = $this->normalizeKeywords($data['keywords'] ?? []);
        $data['training_phrases'] = array_values(array_filter(array_map(
            fn ($p) => trim((string) $p),
            $data['training_phrases'],
        )));

        if (count($data['training_phrases']) === 0) {
            throw ValidationException::withMessages([
                'training_phrases' => ['Add at least one training phrase.'],
            ]);
        }

        $data['owner'] = trim((string) ($data['owner'] ?? '')) ?: null;
        $data['description'] = trim((string) ($data['description'] ?? '')) ?: null;

        return $data;
    }

    /** @param  array<int|string, mixed>  $keywords */
    private function normalizeKeywords(array $keywords): array
    {
        $normalized = [];
        foreach ($keywords as $key => $value) {
            if (is_int($key) && is_string($value)) {
                $phrase = strtolower(trim($value));
                if ($phrase !== '') {
                    $normalized[$phrase] = ($normalized[$phrase] ?? 0) + 2;
                }
                continue;
            }
            if (is_string($key)) {
                $phrase = strtolower(trim($key));
                $weight = is_numeric($value) ? (int) $value : 2;
                if ($phrase !== '') {
                    $normalized[$phrase] = max(1, min(10, $weight));
                }
            }
        }

        return $normalized;
    }

  /** @return array<string, mixed> */
    private function toPayload(ChatbotIntent $intent, \DateTimeInterface $since, bool $detailed = false): array
    {
        $hits7d = ChatbotInteraction::query()
            ->where('intent_id', $intent->id)
            ->where('created_at', '>=', $since)
            ->count();

        $payload = [
            'id' => $intent->id,
            'slug' => $intent->slug,
            'name' => $intent->name,
            'description' => $intent->description,
            'owner' => $intent->owner,
            'hits' => $hits7d,
            'rate' => $this->resolutionRateForIntent($intent->id, $since),
            'is_active' => $intent->is_active,
            'updated_at' => $intent->updated_at?->toIso8601String(),
        ];

        if ($detailed) {
            $payload['answer'] = $intent->answer;
            $payload['keywords'] = $intent->keywords ?? [];
            $payload['training_phrases'] = $intent->training_phrases ?? [];
        }

        return $payload;
    }

    private function resolutionRateForIntent(int $intentId, \DateTimeInterface $since): int
    {
        $total = ChatbotInteraction::query()
            ->where('intent_id', $intentId)
            ->where('created_at', '>=', $since)
            ->count();

        if ($total === 0) {
            return 0;
        }

        $resolved = ChatbotInteraction::query()
            ->where('intent_id', $intentId)
            ->where('created_at', '>=', $since)
            ->where('resolved', true)
            ->count();

        return (int) round(($resolved / $total) * 100);
    }
}
