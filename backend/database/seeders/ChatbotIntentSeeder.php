<?php

namespace Database\Seeders;

use App\Models\ChatbotIntent;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ChatbotIntentSeeder extends Seeder
{
    public function run(): void
    {
        $intents = [
            [
                'slug' => 'track_delivery',
                'name' => 'Track Delivery',
                'description' => 'User wants to track delivery status',
                'owner' => 'Support Team',
                'answer' => "To track a delivery, enter your Tracking ID (e.g. TRK-ABC123 or DLX-2026-001).\n\nYou can paste the code in chat, use Track Delivery, or open the public tracking page.",
                'keywords' => ['track' => 3, 'tracking' => 3, 'saan' => 3, 'nasaan' => 3, 'padala' => 2],
                'training_phrases' => [
                    'Saan yung delivery ko?',
                    'I-track ko yung package',
                    'Where is my delivery?',
                ],
            ],
            [
                'slug' => 'job_status',
                'name' => 'Job Status',
                'description' => 'Questions about job order or dispatch status',
                'owner' => 'Dispatch Team',
                'answer' => "Job orders move from Pending to Dispatched, through pickup and destination legs, until Completed.\n\nCustomers can track by Tracking ID. Dispatchers update status in the fleet dispatch workspace.",
                'keywords' => ['job order' => 3, 'job status' => 3, 'dispatch status' => 2],
                'training_phrases' => [
                    'Job status?',
                    'San ang trabaho?',
                    'Update sa dispatch',
                ],
            ],
            [
                'slug' => 'navigation_help',
                'name' => 'Navigation Help',
                'description' => 'Portal navigation and account access help',
                'owner' => 'Support Team',
                'answer' => "Sign in at the customer login page to view linked deliveries, history, and concerns.\n\nUse Link Delivery if a shipment is missing. Staff roles (admin, dispatcher, manager, driver) each have their own login portals.",
                'keywords' => ['login' => 2, 'navigate' => 2, 'paano mag' => 2, 'saan ang' => 2],
                'training_phrases' => [
                    'Paano mag-login?',
                    'Saan ang live map?',
                ],
            ],
            [
                'slug' => 'submit_concern',
                'name' => 'Submit Concern',
                'description' => 'User wants to file inquiry, complaint, or feedback',
                'owner' => 'Support Team',
                'answer' => "You can submit a concern via the Support form, Feedback page, or chat assistant.\n\nYou'll receive a reference number (e.g. INQ-2026-0001) and email confirmation at deliverexapp@gmail.com.",
                'keywords' => ['concern' => 3, 'complaint' => 3, 'reklamo' => 4, 'feedback' => 2, 'inquiry' => 3],
                'training_phrases' => [
                    'Mag reklamo ako',
                    'Submit a complaint',
                    'I want to give feedback',
                ],
            ],
            [
                'slug' => 'ocr_tips',
                'name' => 'OCR Tips',
                'description' => 'How delivery document OCR and validation works',
                'owner' => 'Admin Team',
                'answer' => "Drivers upload delivery receipts. OCR extracts fields like dimensions, volume, and receipt numbers.\n\nAdmins review results in OCR Review — comparing extracted data with system records before approval.",
                'keywords' => ['ocr' => 4, 'document' => 2, 'delivery receipt' => 3, 'validation' => 2],
                'training_phrases' => [
                    'OCR flagged',
                    'How to approve document',
                ],
            ],
        ];

        foreach ($intents as $intent) {
            ChatbotIntent::query()->updateOrCreate(
                ['slug' => $intent['slug']],
                $intent + ['is_active' => true],
            );
        }
    }
}
