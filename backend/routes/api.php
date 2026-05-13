<?php

use App\Http\Controllers\Admin\AuditLogsController;
use App\Http\Controllers\Admin\DriverController as AdminDriverController;
use App\Http\Controllers\Admin\OcrReviewController;
use App\Http\Controllers\Admin\RolesController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Admin\VehicleController as AdminVehicleController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Customer\InquiryController;
use App\Http\Controllers\Customer\PortalController as CustomerPortalController;
use App\Http\Controllers\Customer\TrackingController as CustomerTrackingController;
use App\Http\Controllers\Dispatcher\AssignmentController as DispatcherAssignmentController;
use App\Http\Controllers\Dispatcher\BestFitController;
use App\Http\Controllers\Dispatcher\JobOrderController;
use App\Http\Controllers\Driver\AssignmentController as DriverAssignmentController;
use App\Http\Controllers\Driver\DocumentController as DriverDocumentController;
use App\Http\Controllers\Driver\StatusController as DriverStatusController;
use App\Http\Controllers\Driver\TrackingController as DriverTrackingController;
use App\Http\Controllers\Gps\TrackingController as GpsTrackingController;
use App\Http\Controllers\Manager\AnalyticsController;
use App\Http\Controllers\Manager\DashboardController;
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

    // ─── Dispatcher ───────────────────────────────────────────────────────────
    Route::middleware('role:dispatcher')->prefix('dispatch')->group(function () {
        Route::get('/job-orders',                    [JobOrderController::class, 'index']);
        Route::get('/job-orders/{jobOrder}',         [JobOrderController::class, 'show']);
        Route::post('/job-orders',                   [JobOrderController::class, 'store']);
        Route::put('/job-orders/{jobOrder}',         [JobOrderController::class, 'update']);
        Route::delete('/job-orders/{jobOrder}',      [JobOrderController::class, 'destroy']);

        Route::get('/assignments',                   [DispatcherAssignmentController::class, 'index']);
        Route::post('/assignments',                  [DispatcherAssignmentController::class, 'store']);

        Route::get('/best-fit/{jobOrder}',           [BestFitController::class, 'show']);
    });

    // ─── Driver ───────────────────────────────────────────────────────────────
    Route::middleware('role:driver')->prefix('driver')->group(function () {
        Route::get('/assignments',                         [DriverAssignmentController::class, 'index']);
        Route::get('/assignments/{assignment}',            [DriverAssignmentController::class, 'show']);
        Route::post('/status',                             [DriverStatusController::class, 'store']);
        Route::post('/tracking',                           [DriverTrackingController::class, 'store']);
        Route::post('/documents',                          [DriverDocumentController::class, 'store']);
    });

    // ─── Manager ──────────────────────────────────────────────────────────────
    Route::middleware('role:manager')->prefix('manager')->group(function () {
        Route::get('/dashboard',  [DashboardController::class, 'index']);
        Route::get('/reports',    [ReportsController::class, 'index']);
        Route::get('/analytics',  [AnalyticsController::class, 'index']);
    });

    // ─── Admin + Dispatcher: GPS tracking view & OCR reprocess ───────────────
    Route::middleware('role:admin|dispatcher')->group(function () {
        Route::get('/tracking/{assignment}',             [GpsTrackingController::class, 'show']);
        Route::post('/ocr/process/{document}',           [OcrController::class, 'process']);
    });
});
