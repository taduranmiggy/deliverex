<?php

use App\Http\Controllers\SpaController;
use Illuminate\Support\Facades\Route;

// CI deploy webhook — fallback when deploy-hook.php is not yet on disk (Apache serves file first when present).
Route::match(['get', 'post'], 'deploy-hook.php', function () {
    require dirname(base_path()) . '/scripts/deploy-webhook-handler.php';
});

Route::get('/{any?}', SpaController::class)->where('any', '^(?!api).*$');
