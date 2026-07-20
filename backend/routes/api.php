<?php

use App\Http\Controllers\ChatbotController;
use App\Http\Controllers\DriverPerformanceController;
use App\Http\Controllers\Admin\ChatbotIntentController;
use App\Http\Controllers\Admin\EmailLogController;
use App\Http\Controllers\Admin\CompanyController as AdminCompanyController;
use App\Http\Controllers\Admin\AuditLogsController;
use App\Http\Controllers\Admin\DocumentFileController;
use App\Http\Controllers\Admin\DriverController as AdminDriverController;
use App\Http\Controllers\Admin\MasterDataController as AdminMasterDataController;
use App\Http\Controllers\Admin\OcrReviewController;
use App\Http\Controllers\Admin\RolesController;
use App\Http\Controllers\Admin\ResourceConsistencyController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Admin\VehicleController as AdminVehicleController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\CompanyActivationController;
use App\Http\Controllers\Customer\InquiryController;
use App\Http\Controllers\Customer\CompanyUserController;
use App\Http\Controllers\Customer\PortalController as CustomerPortalController;
use App\Http\Controllers\Customer\TrackingController as CustomerTrackingController;
use App\Http\Controllers\ExportPreviewController;
use App\Http\Controllers\AssignmentAuditController;
use App\Http\Controllers\IssueReportController;
use App\Http\Controllers\VehicleUtilizationController;
use App\Http\Controllers\Dispatcher\AssignmentController as DispatcherAssignmentController;
use App\Http\Controllers\Dispatcher\FleetLiveTrackingController;
use App\Http\Controllers\Dispatcher\BestFitController;
use App\Http\Controllers\Dispatcher\CalendarController;
use App\Http\Controllers\Dispatcher\DelayController as DispatcherDelayController;
use App\Http\Controllers\Dispatcher\JobOrderController;
use App\Http\Controllers\Dispatcher\MaterialMasterDataController;
use App\Http\Controllers\Dispatcher\MasterDataOptionsController;
use App\Http\Controllers\Driver\AssignmentController as DriverAssignmentController;
use App\Http\Controllers\Driver\SyncConflictController;
use App\Http\Controllers\JobOrderMapController;
use App\Http\Controllers\JobOrderTrackingController;
use App\Http\Controllers\Mobile\LocationController as MobileLocationController;
use App\Http\Controllers\Driver\ProfileController as DriverProfileController;
use App\Http\Controllers\Driver\CompletionProofController as DriverCompletionProofController;
use App\Http\Controllers\Driver\DelayController as DriverDelayController;
use App\Http\Controllers\Driver\IssueController as DriverIssueController;
use App\Http\Controllers\Driver\OfflineSyncController;
use App\Http\Controllers\Driver\DocumentController as DriverDocumentController;
use App\Http\Controllers\Driver\StatusController as DriverStatusController;
use App\Http\Controllers\Driver\TrackingController as DriverTrackingController;
use App\Http\Controllers\Gps\TrackingController as GpsTrackingController;
use App\Http\Controllers\GeocodingController;
use App\Http\Controllers\Manager\AnalyticsController;
use App\Http\Controllers\Manager\DashboardController;
use App\Http\Controllers\Manager\FleetController;
use App\Http\Controllers\Manager\ReportExportController;
use App\Http\Controllers\Manager\ReportsController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Ocr\OcrController;
use App\Http\Controllers\PsgcController;
use Illuminate\Support\Facades\Route;

// ─── Public ──────────────────────────────────────────────────────────────────
Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:10,1');
Route::post('/auth/refresh', [AuthController::class, 'refresh'])
    ->middleware('throttle:30,1');
Route::get('/auth/company/activate/{token}', [CompanyActivationController::class, 'show']);
Route::post('/auth/company/activate/{token}', [CompanyActivationController::class, 'activate'])
    ->middleware('throttle:10,1');
Route::get('/auth/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->middleware('signed')
    ->name('verification.verify');
Route::post('/auth/verify/resend', [AuthController::class, 'resendVerification'])
    ->middleware('throttle:6,1');
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])
    ->middleware('throttle:6,1');
Route::get('/auth/reset-password/context', [AuthController::class, 'passwordResetContext'])
    ->middleware('throttle:12,1');
Route::get('/auth/activate-account/context', [AuthController::class, 'accountActivationContext'])
    ->middleware('throttle:12,1');
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])
    ->middleware('throttle:6,1');

// Public: customer tracking (no auth required)
Route::get('/customer/track/{trackingCode}', [CustomerTrackingController::class, 'show'])
    ->middleware('throttle:60,1');

// Public: submit inquiry (no auth required)
Route::post('/customer/inquiry', [InquiryController::class, 'store']);

// Public reference data is required by both authenticated forms and account activation.
// The backend proxy adds caching, a stable response shape, and useful outage messages.
Route::middleware('throttle:120,1')->prefix('psgc')->group(function () {
    Route::get('/regions', [PsgcController::class, 'regions']);
    Route::get('/regions/{region}/provinces', [PsgcController::class, 'provinces']);
    Route::get('/regions/{region}/cities-municipalities', [PsgcController::class, 'regionalCities']);
    Route::get('/regions/{region}/provinces/{province}/cities-municipalities', [PsgcController::class, 'provincialCities']);
    Route::get('/regions/{region}/cities-municipalities/{city}/barangays', [PsgcController::class, 'regionalBarangays']);
    Route::get('/regions/{region}/provinces/{province}/cities-municipalities/{city}/barangays', [PsgcController::class, 'provincialBarangays']);
});

// Public: intelligent chatbot (optional auth for personalized replies)
Route::middleware(['auth.api.optional', 'throttle:30,1'])->prefix('chatbot')->group(function () {
    Route::get('/welcome', [ChatbotController::class, 'welcome']);
    Route::post('/message', [ChatbotController::class, 'message']);
});

// ─── Authenticated ────────────────────────────────────────────────────────────
Route::middleware('auth.api')->group(function () {

    Route::middleware('throttle:60,1')->prefix('geocoding')->group(function () {
        Route::post('/autocomplete', [GeocodingController::class, 'autocomplete']);
        Route::post('/traces/{trace}/confirm', [GeocodingController::class, 'confirm']);
        Route::post('/traces/{trace}/rendered', [GeocodingController::class, 'rendered']);
    });

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/revoke', [AuthController::class, 'revoke']);
    Route::get('/auth/session', [AuthController::class, 'session']);
    Route::get('/auth/me',      [AuthController::class, 'me']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

    // Shared notifications (any authenticated user)
    Route::get('/notifications',                               [NotificationController::class, 'index']);
    Route::put('/notifications/{notificationLog}/read',        [NotificationController::class, 'markRead']);

    // ─── Customer Portal ──────────────────────────────────────────────────────
    Route::middleware('role:customer')->prefix('customer/portal')->group(function () {
        Route::get('/orders', [CustomerPortalController::class, 'orders']);
        Route::post('/link-delivery', [CustomerPortalController::class, 'linkDelivery']);
        Route::get('/concerns', [InquiryController::class, 'mine']);
        Route::post('/concerns', [InquiryController::class, 'storeForCustomer']);
    });

    Route::middleware(['role:customer', 'company.role:owner'])->prefix('company/users')->group(function () {
        Route::get('/', [CompanyUserController::class, 'index']);
        Route::post('/', [CompanyUserController::class, 'store']);
        Route::put('/{companyUser}', [CompanyUserController::class, 'update']);
        Route::delete('/{companyUser}', [CompanyUserController::class, 'destroy']);
    });

    // ─── Admin ────────────────────────────────────────────────────────────────
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/fleet/consistency',        [ResourceConsistencyController::class, 'show']);
        Route::post('/fleet/reconcile',         [ResourceConsistencyController::class, 'reconcile']);

        Route::get('/roles',                [RolesController::class, 'index']);
        Route::get('/audit-logs',           [AuditLogsController::class, 'index']);
        Route::get('/audit-logs/export',    [AuditLogsController::class, 'export']);
        Route::get('/geocoding-traces',     [GeocodingController::class, 'index']);
        Route::get('/geocoding-traces/{trace}', [GeocodingController::class, 'showTrace']);
        Route::get('/email-logs',           [EmailLogController::class, 'index']);
        Route::get('/email-logs/types',     [EmailLogController::class, 'types']);
        Route::get('/email-logs/stats',    [EmailLogController::class, 'stats']);
        Route::post('/email-logs/{emailLog}/retry', [EmailLogController::class, 'retry']);

        Route::get('/users',                [AdminUserController::class, 'index']);
        Route::post('/users',               [AdminUserController::class, 'store']);
        Route::put('/users/{user}',         [AdminUserController::class, 'update']);
        Route::post('/users/{user}/send-invite', [AdminUserController::class, 'sendInvite']);
        Route::delete('/users/{user}',      [AdminUserController::class, 'destroy']);

        Route::get('/companies',                        [AdminCompanyController::class, 'index']);
        Route::post('/companies',                       [AdminCompanyController::class, 'store']);
        Route::get('/companies/{company}',              [AdminCompanyController::class, 'show']);
        Route::put('/companies/{company}',              [AdminCompanyController::class, 'update']);
        Route::post('/companies/{company}/resend-activation', [AdminCompanyController::class, 'resendActivation']);

        Route::get('/drivers',              [AdminDriverController::class, 'index']);
        Route::post('/drivers',             [AdminDriverController::class, 'store']);
        Route::put('/drivers/{driver}',     [AdminDriverController::class, 'update']);
        Route::delete('/drivers/{driver}',  [AdminDriverController::class, 'destroy']);

        Route::get('/vehicles',             [AdminVehicleController::class, 'index']);
        Route::post('/vehicles',            [AdminVehicleController::class, 'store']);
        Route::put('/vehicles/{vehicle}',   [AdminVehicleController::class, 'update']);
        Route::delete('/vehicles/{vehicle}',[AdminVehicleController::class, 'destroy']);

        Route::get('/master-data',                              [AdminMasterDataController::class, 'index']);
        // Driver account-generation helpers (must come before the generic {resource}/{id} routes)
        Route::post('/master-data/drivers/generate-all-accounts',   [AdminMasterDataController::class, 'generateAllDriverAccounts']);
        Route::post('/master-data/drivers/{driver}/generate-account', [AdminMasterDataController::class, 'generateDriverAccount']);
        Route::post('/master-data/{resource}',                  [AdminMasterDataController::class, 'upsert']);
        Route::put('/master-data/{resource}/{id}',              [AdminMasterDataController::class, 'upsert']);
        Route::delete('/master-data/{resource}/{id}',           [AdminMasterDataController::class, 'archive']);

        Route::get('/ocr/review',                       [OcrReviewController::class, 'index']);
        Route::get('/ocr/review/export',                [OcrReviewController::class, 'export']);
        Route::put('/ocr/{ocrResult}/corrections',     [OcrReviewController::class, 'saveCorrections']);
        Route::put('/ocr/{ocrResult}/validate',         [OcrReviewController::class, 'validateResult']);

        Route::get('/chatbot/stats',                    [ChatbotIntentController::class, 'stats']);
        Route::get('/chatbot/intents',                  [ChatbotIntentController::class, 'index']);
        Route::post('/chatbot/intents',                 [ChatbotIntentController::class, 'store']);
        Route::get('/chatbot/intents/{chatbotIntent}',  [ChatbotIntentController::class, 'show']);
        Route::put('/chatbot/intents/{chatbotIntent}',  [ChatbotIntentController::class, 'update']);
        Route::delete('/chatbot/intents/{chatbotIntent}', [ChatbotIntentController::class, 'destroy']);
    });

    // ─── Admin: inquiries ────────────────────────────────────────────────────
    Route::middleware('role:admin')->prefix('inquiries')->group(function () {
        Route::get('/',                        [InquiryController::class, 'index']);
        Route::get('/{inquiry}',               [InquiryController::class, 'show']);
        Route::put('/{inquiry}/read',          [InquiryController::class, 'markRead']);
        Route::post('/{inquiry}/convert',      [InquiryController::class, 'convert']);
        Route::delete('/{inquiry}',            [InquiryController::class, 'destroy']);
    });

    // ─── Dispatcher + Admin: READ-ONLY job order & assignment data ───────────
    // Admin can view job orders and assignments for monitoring purposes only.
    Route::middleware('role:admin|dispatcher')->prefix('dispatch')->group(function () {
        Route::get('/job-orders',               [JobOrderController::class, 'index']);
        Route::get('/job-orders/{jobOrder}',    [JobOrderController::class, 'show']);
        Route::get('/assignments',              [DispatcherAssignmentController::class, 'index']);
        Route::get('/fleet-live',               [FleetLiveTrackingController::class, 'index']);
        Route::get('/master-data/options',      [MasterDataOptionsController::class, 'index']);
        Route::get('/delays',                   [DispatcherDelayController::class, 'index']);
    });

    // ─── Dispatcher ONLY: write operations — Admin is intentionally excluded ─
    // Assignment creation and job order mutation are restricted to the Dispatcher role.
    Route::middleware('role:dispatcher')->prefix('dispatch')->group(function () {
        Route::post('/job-orders',                    [JobOrderController::class, 'store']);
        Route::put('/job-orders/{jobOrder}',          [JobOrderController::class, 'update']);
        Route::delete('/job-orders/{jobOrder}',       [JobOrderController::class, 'destroy']);

        Route::post('/assignments',                   [DispatcherAssignmentController::class, 'store']);
        Route::get('/best-fit/{jobOrder}',            [BestFitController::class, 'show']);
        Route::get('/calendar',                       [CalendarController::class, 'index']);
        Route::post('/master-data/material-types',    [MaterialMasterDataController::class, 'storeMaterialType']);
        Route::post('/master-data/material-specifications', [MaterialMasterDataController::class, 'storeMaterialSpecification']);
        Route::put('/delays/{delayReport}/acknowledge', [DispatcherDelayController::class, 'acknowledge']);
    });

    // ─── Mobile GPS (driver PWA) ──────────────────────────────────────────────
    Route::middleware('role:driver')->prefix('mobile')->group(function () {
        Route::post('/location/update', [MobileLocationController::class, 'update'])->middleware('throttle:120,1');
    });

    // ─── Driver ───────────────────────────────────────────────────────────────
    Route::middleware('role:driver')->prefix('driver')->group(function () {
        Route::get('/profile',                             [DriverProfileController::class, 'show']);
        Route::put('/profile',                             [DriverProfileController::class, 'update']);
        Route::get('/assignments',                         [DriverAssignmentController::class, 'index']);
        Route::get('/assignments/{assignment}',            [DriverAssignmentController::class, 'show']);
        Route::post('/status',                             [DriverStatusController::class, 'store']);
        Route::post('/tracking',                           [DriverTrackingController::class, 'store'])->middleware('throttle:120,1');
        Route::post('/documents',                          [DriverDocumentController::class, 'store']);
        Route::post('/issues',                             [DriverIssueController::class, 'store']);
        Route::post('/delays',                             [DriverDelayController::class, 'store']);
        Route::post('/completion-proof',                   [DriverCompletionProofController::class, 'store']);
        Route::post('/offline-queue',                      [OfflineSyncController::class, 'store']);
        Route::post('/offline-queue/synced',               [OfflineSyncController::class, 'markSynced']);
        Route::get('/sync-conflicts',                      [SyncConflictController::class, 'index']);
        Route::post('/sync-conflicts',                     [SyncConflictController::class, 'store']);
    });

    // ─── Manager ──────────────────────────────────────────────────────────────
    Route::middleware('role:manager')->prefix('manager')->group(function () {
        Route::get('/dashboard',  [DashboardController::class, 'index']);
        Route::get('/reports',         [ReportsController::class, 'index']);
        Route::get('/reports/export', [ReportExportController::class, 'export']);
        Route::get('/analytics',       [AnalyticsController::class, 'index']);
        Route::get('/active-deliveries', [FleetController::class, 'index']);
        Route::get('/vehicle-utilization', [VehicleUtilizationController::class, 'index']);
    });

    // ─── Admin + Manager: export preview ─────────────────────────────────────
    Route::middleware('role:admin|manager')->group(function () {
        Route::get('/exports/preview', [ExportPreviewController::class, 'show']);
        Route::get('/reports/export', [ReportExportController::class, 'export']);
    });

    // ─── Admin + Manager: driver performance scoring ─────────────────────────
    Route::middleware('role:admin|manager')->group(function () {
        Route::get('/driver-performance', [DriverPerformanceController::class, 'index']);
    });

    // ─── Dispatcher + Manager: issue report review ───────────────────────────
    Route::middleware('role:dispatcher|manager')->group(function () {
        Route::get('/issue-reports', [IssueReportController::class, 'index']);
    });

    // ─── Admin + Dispatcher + Manager: assignment audit trail ────────────────
    Route::middleware('role:admin|dispatcher|manager')->group(function () {
        Route::get('/assignment-audit', [AssignmentAuditController::class, 'index']);
    });

    // ─── Admin + Dispatcher + Manager: GPS tracking view & OCR reprocess ─────
    Route::middleware('role:admin|dispatcher|manager|driver|customer')->group(function () {
        Route::get('/job-orders/{jobOrder}/map', [JobOrderMapController::class, 'show']);
        Route::get('/job-orders/{jobOrder}/tracking', [JobOrderTrackingController::class, 'show']);
    });

    Route::middleware('role:admin|dispatcher|manager')->group(function () {
        Route::get('/tracking/{assignment}',             [GpsTrackingController::class, 'show']);
    });

    // ─── OCR review: read queue (manager view-only) + validate (admin/dispatcher) ─
    Route::middleware('role:admin|dispatcher|manager')->prefix('ocr')->group(function () {
        Route::get('/review', [OcrReviewController::class, 'index']);
    });

    Route::middleware('role:admin')->prefix('ocr')->group(function () {
        Route::put('/{ocrResult}/corrections', [OcrReviewController::class, 'saveCorrections']);
        Route::put('/{ocrResult}/validate', [OcrReviewController::class, 'validateResult']);
    });

    Route::middleware('role:admin|dispatcher')->group(function () {
        Route::post('/ocr/process/{document}', [OcrController::class, 'process']);
    });

    // Admin, Dispatcher, and Manager can all view uploaded proof images
    Route::middleware('role:admin|dispatcher|manager')->group(function () {
        Route::get('/documents/{document}/file', [DocumentFileController::class, 'show']);
    });
});
