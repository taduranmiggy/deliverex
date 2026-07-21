<?php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$user = App\Models\User::where('email', 'manager@deliverex.com')->first();
if (! $user) {
    echo "no manager user\n";
    exit(1);
}
Illuminate\Support\Facades\Auth::onceUsingId($user->id);
$request = Illuminate\Http\Request::create('/api/manager/analytics', 'GET');
$response = $kernel->handle($request);
echo $response->getStatusCode() . "\n";
echo substr($response->getContent(), 0, 1600) . "\n";
$kernel->terminate($request, $response);
