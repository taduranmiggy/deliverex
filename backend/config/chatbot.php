<?php

return [
    'support_email' => env('MAIL_SUPPORT_ADDRESS', 'deliverexapp@gmail.com'),
    'support_phone' => env('CHATBOT_SUPPORT_PHONE', '(+63) 995-582-0222'),
    'company_name' => env('CHATBOT_COMPANY_NAME', 'Providential 628 Site Preparation Services'),
    'office_address' => env(
        'CHATBOT_OFFICE_ADDRESS',
        '7353 Casa Zaragoza Cluster 3, Commonwealth Avenue Extension, San Benissa Garden Villas, Kaligayahan, District 5, Quezon City 1124',
    ),
    'business_hours' => env('CHATBOT_BUSINESS_HOURS', 'Monday to Saturday from 9:00 AM to 8:00 PM'),

    'rate_limit' => [
        'max_attempts' => (int) env('CHATBOT_RATE_LIMIT', 30),
        'decay_minutes' => 1,
    ],

    'knowledge' => [
        'overview' => [
            'title' => 'What is Deliverex?',
            'keywords' => [
                'deliverex' => 3, 'system' => 2, 'platform' => 2, 'app' => 1,
                'logistics' => 2, 'dispatch' => 2, 'fleet' => 2, 'ano' => 1, 'what is' => 2,
            ],
            'answer' => "Deliverex is a fleet dispatch and delivery management platform. It connects dispatchers, drivers, managers, and customers in one system.\n\nCustomers can track deliveries, view proof of delivery, and submit concerns. Dispatchers create job orders, assign drivers using Best-Fit scoring, and monitor GPS. Admins manage users, companies, vehicles, and OCR document review.",
        ],
        'tracking' => [
            'title' => 'Track a delivery',
            'keywords' => [
                'track' => 3, 'tracking' => 3, 'saan' => 3, 'nasaan' => 3, 'status' => 2,
                'delivery status' => 3, 'where is' => 3, 'padala' => 2, 'shipment' => 2,
            ],
            'answer' => "To track a delivery, enter your Tracking ID (e.g. TRK-ABC123 or DLX-2026-001).\n\nYou can paste the code here in chat, use Track My Delivery, or open the public tracking page. You'll see the current status, timeline, ETA, and proof of delivery when completed.",
        ],
        'tracking_id' => [
            'title' => 'Tracking ID',
            'keywords' => [
                'tracking id' => 4, 'tracking code' => 4, 'reference' => 2, 'code' => 1,
                'find tracking' => 3, 'saan makikita' => 3,
            ],
            'answer' => "A Tracking ID is a unique code for your shipment (examples: TRK-ABC123, DLX-2026-001).\n\nYou'll receive it via SMS, email, or from your dispatcher. Use it on the tracking page or here in chat to see live status, timeline, and POD when finished.",
        ],
        'delivery_statuses' => [
            'title' => 'Delivery statuses',
            'keywords' => [
                'status mean' => 3, 'pending' => 2, 'dispatched' => 2, 'en route' => 2,
                'arrived' => 2, 'completed' => 2, 'pickup' => 2, 'destination' => 2,
                'lifecycle' => 2, 'stage' => 1,
            ],
            'answer' => "Delivery status flow:\n\n• Pending — order received, awaiting dispatch\n• Dispatched — driver and vehicle assigned\n• En Route to Pickup — driver heading to pickup\n• Arrived at Pickup — loading cargo\n• Enroute to Destination — cargo loaded, heading to drop-off\n• Arrived — driver at destination\n• Completed — delivery finished; POD may be available",
        ],
        'account_login' => [
            'title' => 'Customer login',
            'keywords' => [
                'login' => 3, 'sign in' => 3, 'account' => 2, 'mag login' => 3,
                'customer account' => 3, 'access' => 1,
            ],
            'answer' => "Customer accounts are created by a Deliverex administrator or linked when a dispatcher creates a delivery using your email.\n\nSign in with your registered email and password at the customer login page. After login you can view linked deliveries, submit concerns, and manage your profile.",
        ],
        'link_delivery' => [
            'title' => 'Link delivery',
            'keywords' => [
                'link delivery' => 4, 'link account' => 3, 'connect' => 2, 'hindi lumalabas' => 2,
                'not showing' => 2, 'missing delivery' => 3,
            ],
            'answer' => "Deliveries for your company are usually linked automatically when a dispatcher creates them with your email.\n\nIf a shipment is not visible after sign-in, open Link Delivery and enter the Tracking ID. The shipment email must match your account email.",
        ],
        'forgot_password' => [
            'title' => 'Reset password',
            'keywords' => [
                'forgot password' => 4, 'reset password' => 4, 'password' => 2,
                'nakalimutan' => 3, 'change password' => 2,
            ],
            'answer' => "On the Forgot Password page, enter your account email. If the account exists, we'll send a reset link.\n\nAfter resetting, sign in with your new password. Staff roles (admin, dispatcher, manager, driver) use the same flow on their respective login pages.",
        ],
        'inquiries' => [
            'title' => 'Submit a concern',
            'keywords' => [
                'inquiry' => 3, 'concern' => 3, 'complaint' => 3, 'reklamo' => 4,
                'feedback' => 2, 'report' => 2, 'problem' => 2, 'problema' => 3,
                'contact support' => 2, 'tulong' => 2, 'help me' => 2,
            ],
            'answer' => "You can submit a concern anytime:\n\n• Use Submit Concern in chat (I'll guide you)\n• Open the Contact / Support form on the website\n• Email or call our support team\n\nConcern types: delivery inquiry, complaint, follow-up, general question, or feedback. You'll receive a reference number (e.g. INQ-2026-0001) and a confirmation email.",
        ],
        'inquiry_types' => [
            'title' => 'Inquiry types',
            'keywords' => [
                'inquiry type' => 3, 'concern type' => 3, 'complaint type' => 2,
                'delivery inquiry' => 3, 'follow up' => 2,
            ],
            'answer' => "Concern types in Deliverex:\n\n• Delivery concern — questions about a specific shipment\n• Complaint — service issues or delays\n• Follow-up — checking on a previous concern\n• General question — how the system works\n• Feedback — suggestions or praise\n\nDispatchers and admins review inquiries and can convert them into job orders when needed.",
        ],
        'pod' => [
            'title' => 'Proof of delivery',
            'keywords' => [
                'pod' => 4, 'proof of delivery' => 4, 'proof' => 2, 'signature' => 2,
                'receiver' => 2, 'delivered' => 2, 'resibo' => 2,
            ],
            'answer' => "Proof of Delivery (POD) is captured when a driver completes a delivery — often via signed document OCR, photo, or completion form with receiver name and notes.\n\nOnce status is Completed, customers can view POD documents on the tracking page if available. Admins may review OCR-extracted data for accuracy.",
        ],
        'delays' => [
            'title' => 'Delivery delays',
            'keywords' => [
                'delay' => 4, 'late' => 3, 'delayed' => 3, 'antala' => 3,
                'behind schedule' => 3, 'eta' => 2,
            ],
            'answer' => "If a delivery passes its scheduled end time without completing, the system flags a delay.\n\nDrivers can report delays with a reason. Dispatchers and managers see delay alerts. For urgent issues, submit a concern with your Tracking ID or contact support directly.",
        ],
        'customer_portal' => [
            'title' => 'Customer portal',
            'keywords' => [
                'portal' => 3, 'dashboard' => 2, 'my orders' => 3, 'my deliveries' => 3,
                'customer home' => 2,
            ],
            'answer' => "The customer portal shows your linked deliveries, tracking history, and submitted concerns.\n\nAfter login you can view orders, link new deliveries, edit your profile, and manage company users if you're a company contact.",
        ],
        'company_accounts' => [
            'title' => 'Company accounts',
            'keywords' => [
                'company' => 3, 'business' => 2, 'corporate' => 2, 'organization' => 2,
                'company user' => 3, 'team' => 1,
            ],
            'answer' => "Companies in Deliverex group customer users under one organization. Admins create company records and invite customer users.\n\nCompany contacts can view shared deliveries and manage company users from the customer portal. Activation is done via email invitation.",
        ],
        'dispatcher_workflow' => [
            'title' => 'How dispatch works',
            'keywords' => [
                'dispatcher' => 3, 'dispatch' => 2, 'assign driver' => 3, 'job order' => 3,
                'create order' => 2, 'fleet dispatch' => 2,
            ],
            'answer' => "Dispatchers create job orders with pickup/drop-off, cargo details, and customer info. They assign drivers and vehicles — manually or via Best-Fit recommendations.\n\nThey monitor live GPS, handle delays, review inquiries, and update delivery status throughout the trip.",
        ],
        'best_fit' => [
            'title' => 'Best-Fit assignment',
            'keywords' => [
                'best fit' => 4, 'best-fit' => 4, 'scoring' => 2, 'recommend' => 2,
                'why this driver' => 3, 'assignment score' => 3,
            ],
            'answer' => "Best-Fit helps dispatchers pick the best driver–vehicle pair for a job order. It scores candidates on vehicle type match, availability, workload, and other factors (max 100 points).\n\nDispatchers see explainable scores and can override with a documented reason. Customers benefit from faster, better-matched assignments.",
        ],
        'ocr' => [
            'title' => 'OCR document review',
            'keywords' => [
                'ocr' => 4, 'document' => 2, 'scan' => 2, 'extract' => 2,
                'delivery receipt' => 3, 'validation' => 2,
            ],
            'answer' => "Drivers upload delivery documents (e.g. delivery receipts). OCR extracts fields like dimensions, volume, and receipt numbers.\n\nAdmins review OCR results in a validation panel — comparing extracted data with system records before approval. This reduces manual data entry and errors.",
        ],
        'gps_tracking' => [
            'title' => 'GPS tracking',
            'keywords' => [
                'gps' => 4, 'location' => 3, 'map' => 2, 'live track' => 3,
                'real time' => 2, 'coordinates' => 2,
            ],
            'answer' => "Drivers share GPS location during active deliveries. Dispatchers and managers see live positions on the fleet map.\n\nCustomers see approximate location and status timeline on the tracking page — not exact driver coordinates for privacy.",
        ],
        'roles' => [
            'title' => 'User roles',
            'keywords' => [
                'role' => 3, 'admin' => 2, 'manager' => 2, 'driver' => 2,
                'who can' => 2, 'permissions' => 2,
            ],
            'answer' => "Deliverex roles:\n\n• Admin — users, companies, vehicles, drivers, OCR review, audit logs\n• Dispatcher — job orders, assignments, GPS, inquiries\n• Manager — analytics, reports, fleet overview\n• Driver — mobile assignments, status updates, POD upload\n• Customer — track deliveries, portal, concerns",
        ],
        'job_orders' => [
            'title' => 'Job orders',
            'keywords' => [
                'job order' => 4, 'order' => 1, 'shipment' => 2, 'booking' => 2,
                'pickup' => 1, 'dropoff' => 2, 'drop off' => 2,
            ],
            'answer' => "A job order is a delivery request with customer details, pickup and drop-off locations, cargo requirements, schedule, and priority.\n\nEach job order gets a Tracking ID. It moves from Pending to assigned and through delivery statuses until Completed or Cancelled.",
        ],
    ],

    'suggestions' => [
        'default' => [
            'Track Delivery',
            'Submit Concern',
            'Status Guide',
            'Account Help',
            'Contact Support',
        ],
        'after_track' => [
            'Track Again',
            'Submit Concern',
            'Contact Support',
            'Menu',
        ],
        'after_answer' => [
            'Track Delivery',
            'Submit Concern',
            'About Deliverex',
            'Contact Support',
        ],
    ],
];
