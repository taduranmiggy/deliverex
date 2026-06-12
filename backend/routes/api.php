<?php

use App\Http\Controllers\Admin\DocumentFileController;
use App\Http\Controllers\Admin\AuditLogsController;
use App\Http\Controllers\Admin\DriverController as AdminDriverController;
use App\Http\Controllers\Admin\MasterDataController as AdminMasterDataController;
use App\Http\Controllers\Admin\OcrReviewController;
use App\Http\Controllers\Admin\RolesController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Admin\VehicleController as AdminVehicleController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Customer\InquiryController;
use App\Http\Controllers\Customer\PortalController as CustomerPortalController;
use App\Http\Controllers\Customer\TrackingController as CustomerTrackingController;
use App\Http\Controllers\DriverPerformanceController;
use App\Http\Controllers\AssignmentAuditController;
use App\Http\Controllers\IssueReportController;
use App\Http\Controllers\VehicleUtilizationController;
use App\Http\Controllers\Dispatcher\AssignmentController as DispatcherAssignmentController;
use App\Http\Controllers\Dispatcher\BestFitController;
use App\Http\Controllers\Dispatcher\ClientHistoryController;
use App\Http\Controllers\Dispatcher\CalendarController;
use App\Http\Controllers\Dispatcher\DelayController as DispatcherDelayController;
use App\Http\Controllers\Dispatcher\JobOrderController;
use App\Http\Controllers\Dispatcher\MaterialMasterDataController;
use App\Http\Controllers\Dispatcher\MasterDataOptionsController;
use App\Http\Controllers\Driver\AssignmentController as DriverAssignmentController;
use App\Http\Controllers\Driver\ProfileController as DriverProfileController;
use App\Http\Controllers\Driver\CompletionProofController as DriverCompletionProofController;
use App\Http\Controllers\Driver\DelayController as DriverDelayController;
use App\Http\Controllers\Driver\IssueController as DriverIssueController;
use App\Http\Controllers\Driver\DocumentController as DriverDocumentController;
use App\Http\Controllers\Driver\StatusController as DriverStatusController;
use App\Http\Controllers\Driver\TrackingController as DriverTrackingController;
use App\Http\Controllers\Gps\TrackingController as GpsTrackingController;
use App\Http\Controllers\Manager\AnalyticsController;
use App\Http\Controllers\Manager\DashboardController;
use App\Http\Controllers\Manager\FleetController;
use App\Http\Controllers\Manager\ReportsController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Ocr\OcrController;
use Illuminate\Support\Facades\Route;

// ─── Public ──────────────────────────────────────────────────────────────────
Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:10,1');
Route::post('/auth/register/customer', [AuthController::class, 'registerCustomer'])
    ->middleware('throttle:10,1');
Route::get('/auth/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->middleware('signed')
    ->name('verification.verify');
Route::post('/auth/verify/resend', [AuthController::class, 'resendVerification'])
    ->middleware('throttle:6,1');

// Public: customer tracking (no auth required)
Route::get('/customer/track/{trackingCode}', [CustomerTrackingController::class, 'show']);

// Public: submit inquiry (no auth required)
Route::post('/customer/inquiry', [InquiryController::class, 'store']);

// ─── Authenticated ────────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',      [AuthController::class, 'me']);

    // Shared notifications (any authenticated user)
    Route::get('/notifications',                               [NotificationController::class, 'index']);
    Route::put('/notifications/{notificationLog}/read',        [NotificationController::class, 'markRead']);

    // ─── Customer Portal ──────────────────────────────────────────────────────
    Route::middleware('role:customer')->prefix('customer/portal')->group(function () {
        Route::get('/orders', [CustomerPortalController::class, 'orders']);
    });

    // ─── Admin ────────────────────────────────────────────────────────────────
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/roles',                [RolesController::class, 'index']);
        Route::get('/audit-logs',           [AuditLogsController::class, 'index']);

        Route::get('/users',                [AdminUserController::class, 'index']);
        Route::post('/users',               [AdminUserController::class, 'store']);
        Route::put('/users/{user}',         [AdminUserController::class, 'update']);
        Route::delete('/users/{user}',      [AdminUserController::class, 'destroy']);

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
        Route::put('/ocr/{ocrResult}/validate',         [OcrReviewController::class, 'validateResult']);
    });

    // ─── Admin + Dispatcher: inquiries ───────────────────────────────────────
    Route::middleware('role:admin|dispatcher')->prefix('inquiries')->group(function () {
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
        Route::get('/master-data/options',      [MasterDataOptionsController::class, 'index']);
        Route::get('/delays',                   [DispatcherDelayController::class, 'index']);
    });

    // ─── Dispatcher ONLY: write operations — Admin is intentionally excluded ─
    // Assignment creation, job order mutation, and Best-Fit dispatch are
    // restricted to the Dispatcher role. Admin receives 403 if attempted.
    Route::middleware('role:dispatcher')->prefix('dispatch')->group(function () {
        Route::post('/job-orders',                    [JobOrderController::class, 'store']);
        Route::put('/job-orders/{jobOrder}',          [JobOrderController::class, 'update']);
        Route::delete('/job-orders/{jobOrder}',       [JobOrderController::class, 'destroy']);

        Route::post('/assignments',                   [DispatcherAssignmentController::class, 'store']);

        Route::get('/clients/{client}/history',       [ClientHistoryController::class, 'show']);
        Route::get('/best-fit/{jobOrder}',            [BestFitController::class, 'show']);
        Route::get('/calendar',                       [CalendarController::class, 'index']);
        Route::post('/master-data/material-types',    [MaterialMasterDataController::class, 'storeMaterialType']);
        Route::post('/master-data/material-specifications', [MaterialMasterDataController::class, 'storeMaterialSpecification']);
        Route::put('/delays/{delayReport}/acknowledge', [DispatcherDelayController::class, 'acknowledge']);
    });

    // ─── Driver ───────────────────────────────────────────────────────────────
    Route::middleware('role:driver')->prefix('driver')->group(function () {
        Route::get('/profile',                             [DriverProfileController::class, 'show']);
        Route::put('/profile',                             [DriverProfileController::class, 'update']);
        Route::get('/assignments',                         [DriverAssignmentController::class, 'index']);
        Route::get('/assignments/{assignment}',            [DriverAssignmentController::class, 'show']);
        Route::post('/status',                             [DriverStatusController::class, 'store']);
        Route::post('/tracking',                           [DriverTrackingController::class, 'store']);
        Route::post('/documents',                          [DriverDocumentController::class, 'store']);
        Route::post('/issues',                             [DriverIssueController::class, 'store']);
        Route::post('/delays',                             [DriverDelayController::class, 'store']);
        Route::post('/completion-proof',                   [DriverCompletionProofController::class, 'store']);
    });

    // ─── Manager ──────────────────────────────────────────────────────────────
    Route::middleware('role:manager')->prefix('manager')->group(function () {
        Route::get('/dashboard',  [DashboardController::class, 'index']);
        Route::get('/reports',    [ReportsController::class, 'index']);
        Route::get('/analytics',  [AnalyticsController::class, 'index']);
        Route::get('/active-deliveries', [FleetController::class, 'index']);
        Route::get('/vehicle-utilization', [VehicleUtilizationController::class, 'index']);
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
    Route::middleware('role:admin|dispatcher|manager')->group(function () {
        Route::get('/tracking/{assignment}',             [GpsTrackingController::class, 'show']);
    });

    Route::middleware('role:admin|dispatcher')->group(function () {
        Route::post('/ocr/process/{document}', [OcrController::class, 'process']);
    });

    // Admin, Dispatcher, and Manager can all view uploaded proof images
    Route::middleware('role:admin|dispatcher|manager')->group(function () {
        Route::get('/documents/{document}/file', [DocumentFileController::class, 'show']);
    });
});
