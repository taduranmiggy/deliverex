<?php

use App\Http\Controllers\Admin\DriverController as AdminDriverController;
use App\Http\Controllers\Admin\OcrReviewController;
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

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:10,1');
Route::post('/auth/register/customer', [AuthController::class, 'registerCustomer'])
    ->middleware('throttle:10,1');

Route::get('/customer/track/{trackingCode}', [CustomerTrackingController::class, 'show']);
Route::post('/customer/inquiry', [InquiryController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    Route::middleware('role:customer')->prefix('customer/portal')->group(function () {
        Route::get('/orders', [CustomerPortalController::class, 'orders']);
    });

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::put('/notifications/{notificationLog}/read', [NotificationController::class, 'markRead']);

    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::post('/users', [AdminUserController::class, 'store']);
        Route::put('/users/{user}', [AdminUserController::class, 'update']);
        Route::delete('/users/{user}', [AdminUserController::class, 'destroy']);

        Route::get('/drivers', [AdminDriverController::class, 'index']);
        Route::post('/drivers', [AdminDriverController::class, 'store']);
        Route::put('/drivers/{driver}', [AdminDriverController::class, 'update']);
        Route::delete('/drivers/{driver}', [AdminDriverController::class, 'destroy']);

        Route::get('/vehicles', [AdminVehicleController::class, 'index']);
        Route::post('/vehicles', [AdminVehicleController::class, 'store']);
        Route::put('/vehicles/{vehicle}', [AdminVehicleController::class, 'update']);
        Route::delete('/vehicles/{vehicle}', [AdminVehicleController::class, 'destroy']);

        Route::get('/ocr/review', [OcrReviewController::class, 'index']);
        Route::put('/ocr/{ocrResult}/validate', [OcrReviewController::class, 'validateResult']);
    });

    Route::middleware('role:dispatcher')->prefix('dispatch')->group(function () {
        Route::get('/job-orders', [JobOrderController::class, 'index']);
        Route::get('/job-orders/{jobOrder}', [JobOrderController::class, 'show']);
        Route::post('/job-orders', [JobOrderController::class, 'store']);
        Route::put('/job-orders/{jobOrder}', [JobOrderController::class, 'update']);

        Route::get('/assignments', [DispatcherAssignmentController::class, 'index']);
        Route::post('/assignments', [DispatcherAssignmentController::class, 'store']);

        Route::get('/best-fit/{jobOrder}', [BestFitController::class, 'show']);
    });

    Route::middleware('role:driver')->prefix('driver')->group(function () {
        Route::get('/assignments', [DriverAssignmentController::class, 'index']);
        Route::get('/assignments/{assignment}', [DriverAssignmentController::class, 'show']);
        Route::post('/status', [DriverStatusController::class, 'store']);
        Route::post('/tracking', [DriverTrackingController::class, 'store']);
        Route::post('/documents', [DriverDocumentController::class, 'store']);
    });

    Route::middleware('role:manager')->prefix('manager')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'index']);
        Route::get('/reports', [ReportsController::class, 'index']);
        Route::get('/analytics', [AnalyticsController::class, 'index']);
    });

    Route::middleware('role:admin|dispatcher|manager')->group(function () {
        Route::get('/tracking/{assignment}', [GpsTrackingController::class, 'show']);
        Route::post('/ocr/process/{document}', [OcrController::class, 'process']);
    });
});
