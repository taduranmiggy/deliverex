<?php

namespace Database\Seeders;

use App\Models\ChatbotIntent;
use Illuminate\Database\Seeder;

class ChatbotIntentSeeder extends Seeder
{
    public function run(): void
    {
        $phone = (string) config('chatbot.support_phone');
        $email = (string) config('chatbot.support_email');
        $company = (string) config('chatbot.company_name');
        $hours = (string) config('chatbot.business_hours');
        $address = (string) config('chatbot.office_address');

        $intents = [
            // Category 1 — Delivery Tracking
            [
                'slug' => 'track_delivery',
                'name' => 'Track Delivery',
                'description' => 'Category 1 — Delivery Tracking',
                'owner' => 'Support Team',
                'answer' => 'Enter your Tracking ID on the Track Delivery page. No account is required. Go to the Deliverex website or app and enter your Tracking ID in the search field.',
                'keywords' => ['track my delivery' => 5, 'track delivery' => 4, 'track' => 2],
                'training_phrases' => ['Track my delivery', 'I want to track my delivery', 'How do I track?'],
            ],
            [
                'slug' => 'get_tracking_id',
                'name' => 'Get Tracking ID',
                'description' => 'Category 1 — Delivery Tracking',
                'owner' => 'Support Team',
                'answer' => "Your Tracking ID was sent to your registered email when your delivery was scheduled. Please check your inbox including your spam folder. If you cannot find it, contact {$company} directly.",
                'keywords' => ['tracking id' => 4, 'tracking code' => 4, 'find tracking' => 3],
                'training_phrases' => ['Where is my Tracking ID?', 'Where can I find my tracking code?', 'Saan ang tracking ID ko?'],
            ],
            [
                'slug' => 'status_pending',
                'name' => 'Status: Pending',
                'description' => 'Category 1 — Delivery Tracking',
                'owner' => 'Support Team',
                'answer' => 'Pending means your job order has been created but a driver and vehicle have not yet been assigned. The dispatcher will assign your delivery shortly.',
                'keywords' => ['pending mean' => 5, 'what does pending' => 5, 'status pending' => 4],
                'training_phrases' => ['What does Pending mean?', 'Pending status meaning'],
            ],
            [
                'slug' => 'status_dispatched',
                'name' => 'Status: Dispatched',
                'description' => 'Category 1 — Delivery Tracking',
                'owner' => 'Support Team',
                'answer' => 'Dispatched means a driver and vehicle have been assigned to your delivery. The driver has received the job assignment and will proceed to the pickup location.',
                'keywords' => ['dispatched mean' => 5, 'what does dispatched' => 5, 'status dispatched' => 4],
                'training_phrases' => ['What does Dispatched mean?', 'Dispatched status meaning'],
            ],
            [
                'slug' => 'status_en_route_pickup',
                'name' => 'Status: En Route to Pickup',
                'description' => 'Category 1 — Delivery Tracking',
                'owner' => 'Support Team',
                'answer' => 'En Route to Pickup means your driver is currently traveling to the loading or pickup location to collect your materials.',
                'keywords' => ['en route to pickup' => 5, 'route to pickup' => 4, 'pickup mean' => 3],
                'training_phrases' => ['What does En Route to Pickup mean?', 'En route to pickup meaning'],
            ],
            [
                'slug' => 'status_arrived_pickup',
                'name' => 'Status: Arrived at Pickup',
                'description' => 'Category 1 — Delivery Tracking',
                'owner' => 'Support Team',
                'answer' => 'Arrived at Pickup means your driver has reached the pickup location and is preparing to load your materials.',
                'keywords' => ['arrived at pickup' => 5, 'arrived pickup mean' => 4],
                'training_phrases' => ['What does Arrived at Pickup mean?', 'Arrived at pickup meaning'],
            ],
            [
                'slug' => 'status_en_route_destination',
                'name' => 'Status: En Route to Destination',
                'description' => 'Category 1 — Delivery Tracking',
                'owner' => 'Support Team',
                'answer' => 'En Route to Destination means your materials have been loaded and the driver is now traveling to your delivery site.',
                'keywords' => ['en route to destination' => 5, 'route to destination' => 4, 'destination mean' => 3],
                'training_phrases' => ['What does En Route to Destination mean?', 'En route to destination meaning'],
            ],
            [
                'slug' => 'status_arrived',
                'name' => 'Status: Arrived',
                'description' => 'Category 1 — Delivery Tracking',
                'owner' => 'Support Team',
                'answer' => 'Arrived means your driver has reached your delivery destination. Please prepare to receive and sign the delivery receipt.',
                'keywords' => ['arrived mean' => 4, 'what does arrived' => 5, 'status arrived' => 4],
                'training_phrases' => ['What does Arrived mean?', 'Arrived status meaning'],
            ],
            [
                'slug' => 'status_completed',
                'name' => 'Status: Completed',
                'description' => 'Category 1 — Delivery Tracking',
                'owner' => 'Support Team',
                'answer' => 'Completed means your delivery has been successfully finished. Your Proof of Delivery document is now available in your Deliverex account under Delivery History.',
                'keywords' => ['completed mean' => 5, 'what does completed' => 5, 'status completed' => 4],
                'training_phrases' => ['What does Completed mean?', 'Completed status meaning'],
            ],
            [
                'slug' => 'delivery_delayed',
                'name' => 'Delivery Delayed',
                'description' => 'Category 1 — Delivery Tracking',
                'owner' => 'Support Team',
                'answer' => "You can check the latest status using your Tracking ID on the Track Delivery page. If you need further assistance, please contact {$company} directly at {$phone}.",
                'keywords' => ['not arrived' => 4, 'delayed' => 3, 'late delivery' => 4, 'has not arrived' => 4],
                'training_phrases' => ['My delivery has not arrived yet', 'My delivery is late', 'Delivery delayed'],
            ],
            [
                'slug' => 'track_multiple',
                'name' => 'Track Multiple Deliveries',
                'description' => 'Category 1 — Delivery Tracking',
                'owner' => 'Support Team',
                'answer' => 'Yes. Enter each Tracking ID separately on the Track Delivery page. If you have a Deliverex account, all deliveries linked to your company are visible under My Deliveries.',
                'keywords' => ['multiple deliveries' => 5, 'track multiple' => 5, 'several tracking' => 3],
                'training_phrases' => ['Can I track multiple deliveries?', 'Track more than one delivery'],
            ],

            // Category 2 — Documents
            [
                'slug' => 'get_pod',
                'name' => 'Get Proof of Delivery',
                'description' => 'Category 2 — Documents',
                'owner' => 'Support Team',
                'answer' => 'Your Proof of Delivery is available in your account under Delivery History once the delivery is marked Completed and approved by the administrator. If it is not yet available, it may still be under review.',
                'keywords' => ['proof of delivery' => 5, 'pod' => 4, 'delivery receipt' => 3],
                'training_phrases' => ['Where is my Proof of Delivery?', 'How do I get POD?', 'Saan ang proof of delivery?'],
            ],
            [
                'slug' => 'document_rejected',
                'name' => 'Document Rejected',
                'description' => 'Category 2 — Documents',
                'owner' => 'Support Team',
                'answer' => 'A rejection means the administrator found an issue with the uploaded receipt — such as poor image quality or an incomplete document. The driver will be notified to resubmit. Please allow time for resubmission and review.',
                'keywords' => ['document rejected' => 5, 'receipt rejected' => 4, 'rejected document' => 4],
                'training_phrases' => ['My document was rejected', 'Receipt was rejected', 'Why was my document rejected?'],
            ],

            // Category 3 — Account and Access
            [
                'slug' => 'create_account',
                'name' => 'How to Create Account',
                'description' => 'Category 3 — Account and Access',
                'owner' => 'Support Team',
                'answer' => "Deliverex accounts are created by the Deliverex administrator — there is no self-registration. Please contact {$company} to request account access and they will send you an activation email.",
                'keywords' => ['create account' => 5, 'sign up' => 4, 'register' => 3, 'new account' => 3],
                'training_phrases' => ['How do I create an account?', 'Paano gumawa ng account?', 'How to register?'],
            ],
            [
                'slug' => 'activation_email',
                'name' => 'Activation Email Not Received',
                'description' => 'Category 3 — Account and Access',
                'owner' => 'Support Team',
                'answer' => 'Please check your spam or junk folder first. If it is not there, the link may have expired. Contact and request the administrator to resend your activation email.',
                'keywords' => ['activation email' => 5, 'invitation email' => 4, 'did not receive' => 3],
                'training_phrases' => ['I did not receive my activation email', 'No activation email', 'Wala akong activation email'],
            ],
            [
                'slug' => 'activation_expired',
                'name' => 'Activation Link Expired',
                'description' => 'Category 3 — Account and Access',
                'owner' => 'Support Team',
                'answer' => "Activation links expire after 72 hours. Please contact {$company} and request a new link. The administrator can resend it at any time.",
                'keywords' => ['activation link expired' => 5, 'link expired' => 4, 'expired invitation' => 4],
                'training_phrases' => ['My activation link expired', 'Activation link not working', 'Expired activation link'],
            ],
            [
                'slug' => 'forgot_password',
                'name' => 'Forgot Password',
                'description' => 'Category 3 — Account and Access',
                'owner' => 'Support Team',
                'answer' => 'Click the Forgot Password link on the Deliverex login page and enter your registered email. A password reset link will be sent to your inbox. Check your spam folder if you do not receive it.',
                'keywords' => ['forgot password' => 5, 'reset password' => 4, 'nakalimutan' => 3],
                'training_phrases' => ['I forgot my password', 'Forgot my password', 'Nakalimutan ko ang password'],
            ],
            [
                'slug' => 'cannot_login',
                'name' => 'Cannot Log In',
                'description' => 'Category 3 — Account and Access',
                'owner' => 'Support Team',
                'answer' => "Make sure you are using the correct email and password. If you forgot your password, click Forgot Password on the login page. If the issue continues, contact {$company} for account assistance.",
                'keywords' => ['cannot log in' => 5, 'cant login' => 5, 'login problem' => 4, 'cannot sign in' => 4],
                'training_phrases' => ['I cannot log in', 'Cannot login', 'Hindi ako makapag-login'],
            ],
            [
                'slug' => 'install_pwa',
                'name' => 'Install PWA',
                'description' => 'Category 3 — Account and Access',
                'owner' => 'Support Team',
                'answer' => 'On Android: Open Deliverex in Chrome, tap the three-dot menu, and select Add to Home Screen. On iPhone: Open Deliverex in Safari, tap the Share button, and select Add to Home Screen.',
                'keywords' => ['install app' => 5, 'add to home screen' => 4, 'pwa' => 4, 'download app' => 3],
                'training_phrases' => ['How do I install the app?', 'Install Deliverex on my phone', 'Paano i-install ang app?'],
            ],
            [
                'slug' => 'supported_devices',
                'name' => 'Supported Devices',
                'description' => 'Category 3 — Account and Access',
                'owner' => 'Support Team',
                'answer' => 'Deliverex works on any browser on desktop or mobile. You can also install it as a Progressive Web App on your phone or download the native Android app. All options use the same account credentials.',
                'keywords' => ['supported devices' => 5, 'what devices' => 4, 'compatible' => 3, 'browser' => 2],
                'training_phrases' => ['What devices can I use?', 'Which phones are supported?', 'Anong device pwede?'],
            ],

            // Category 4 — Company Information
            [
                'slug' => 'contact_info',
                'name' => 'Contact Information',
                'description' => 'Category 4 — Company Information',
                'owner' => 'Support Team',
                'answer' => "You can reach {$company} at:\nPhone: {$phone}\nEmail: {$email}\nBusiness Hours: {$hours}",
                'keywords' => ['contact providential' => 5, 'contact information' => 4, 'phone number' => 3, 'how to contact' => 4],
                'training_phrases' => ['How do I contact Providential 628?', 'Contact details', 'Company phone number'],
            ],
            [
                'slug' => 'business_hours',
                'name' => 'Business Hours',
                'description' => 'Category 4 — Company Information',
                'owner' => 'Support Team',
                'answer' => "{$company} is open {$hours}. Deliverex is available 24 hours a day for delivery tracking and account access.",
                'keywords' => ['business hours' => 5, 'opening hours' => 4, 'office hours' => 4, 'what time' => 3],
                'training_phrases' => ['What are your business hours?', 'What time are you open?', 'Anong oras kayo bukas?'],
            ],
            [
                'slug' => 'office_location',
                'name' => 'Office Location',
                'description' => 'Category 4 — Company Information',
                'owner' => 'Support Team',
                'answer' => "{$company} is located at {$address}.",
                'keywords' => ['office location' => 5, 'where is your office' => 5, 'address' => 3, 'location' => 2],
                'training_phrases' => ['Where is your office?', 'Office address', 'Saan ang opisina?'],
            ],
            [
                'slug' => 'services_offered',
                'name' => 'Services Offered',
                'description' => 'Category 4 — Company Information',
                'owner' => 'Support Team',
                'answer' => 'Providential 628 provides hauling services for heavy equipment and construction materials using a fleet of 10-Wheeler trucks and ADTs. Contact our office to request a delivery or quotation.',
                'keywords' => ['services offered' => 5, 'what services' => 4, 'hauling' => 3, 'trucks' => 2],
                'training_phrases' => ['What services do you offer?', 'What do you haul?', 'Anong serbisyo ninyo?'],
            ],
            [
                'slug' => 'request_delivery',
                'name' => 'Request Delivery',
                'description' => 'Category 4 — Company Information',
                'owner' => 'Support Team',
                'answer' => "To request a delivery, contact {$company} directly at {$phone}. Our team will coordinate the scheduling and job order details with you.",
                'keywords' => ['request delivery' => 5, 'book delivery' => 4, 'schedule delivery' => 4, 'order delivery' => 3],
                'training_phrases' => ['How do I request a delivery?', 'Book a delivery', 'Paano mag-request ng delivery?'],
            ],
            [
                'slug' => 'about_deliverex',
                'name' => 'About Deliverex',
                'description' => 'Category 4 — Company Information',
                'owner' => 'Support Team',
                'answer' => "Deliverex is the official logistics management system of {$company}. Clients can track deliveries in real time, access Proof of Delivery documents, and get quick answers through this chatbot.",
                'keywords' => ['what is deliverex' => 5, 'about deliverex' => 5, 'deliverex' => 2],
                'training_phrases' => ['What is Deliverex?', 'Tell me about Deliverex', 'Ano ang Deliverex?'],
            ],

            // Category 5 — Fallback and Greetings
            [
                'slug' => 'greeting',
                'name' => 'Greeting',
                'description' => 'Category 5 — Fallback and Greetings',
                'owner' => 'Support Team',
                'answer' => 'Hello! Welcome to Deliverex. I can help you track your delivery, answer account questions, or provide company information. What can I help you with today?',
                'keywords' => ['hello' => 3, 'hi' => 2, 'hey' => 2, 'good morning' => 3],
                'training_phrases' => ['Hello', 'Hi', 'Hey', 'Good morning', 'Kamusta'],
            ],
            [
                'slug' => 'thank_you',
                'name' => 'Thank You',
                'description' => 'Category 5 — Fallback and Greetings',
                'owner' => 'Support Team',
                'answer' => 'You are welcome! Feel free to ask if you have any other questions. Have a great day!',
                'keywords' => ['thank you' => 5, 'thanks' => 4, 'salamat' => 4],
                'training_phrases' => ['Thank you', 'Thanks', 'Salamat'],
            ],
            [
                'slug' => 'goodbye',
                'name' => 'Goodbye',
                'description' => 'Category 5 — Fallback and Greetings',
                'owner' => 'Support Team',
                'answer' => 'Thank you for using Deliverex. Have a great day!',
                'keywords' => ['goodbye' => 5, 'bye' => 4, 'see you' => 3],
                'training_phrases' => ['Goodbye', 'Bye', 'See you'],
            ],

            // Core chatbot flows (kept for guided actions)
            [
                'slug' => 'submit_concern',
                'name' => 'Submit Concern',
                'description' => 'Concerns & Support',
                'owner' => 'Support Team',
                'answer' => "You can submit a concern via the Support form or through this chat assistant.\n\nYou'll receive a reference number (e.g. INQ-2026-0001) and email confirmation at {$email}.",
                'keywords' => ['concern' => 3, 'complaint' => 3, 'reklamo' => 4, 'feedback' => 2, 'inquiry' => 3],
                'training_phrases' => ['Submit a complaint', 'I want to file a concern', 'Mag reklamo ako'],
            ],
        ];

        $activeSlugs = [];

        foreach ($intents as $intent) {
            $activeSlugs[] = $intent['slug'];
            ChatbotIntent::query()->updateOrCreate(
                ['slug' => $intent['slug']],
                $intent + ['is_active' => true],
            );
        }

        ChatbotIntent::query()
            ->whereNotIn('slug', $activeSlugs)
            ->update(['is_active' => false]);
    }
}
