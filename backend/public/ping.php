<?php
// Health probe — https://deliverexapp.com/ping.php
declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');

echo "pong\n";
echo 'php=' . PHP_VERSION . "\n";

$backendRoot = dirname(__DIR__);
$envPath = $backendRoot . '/.env';
$envReal = is_link($envPath) ? readlink($envPath) : $envPath;
$envExists = file_exists($envPath) || (is_link($envPath) && file_exists($envReal));

echo 'env=' . ($envExists ? 'yes' : 'no') . "\n";
echo 'vendor=' . (file_exists($backendRoot . '/vendor/autoload.php') ? 'yes' : 'no') . "\n";

$sharedRoot = dirname($backendRoot, 2) . '/shared';
if (! is_dir($sharedRoot)) {
    $sharedRoot = dirname($backendRoot) . '/shared';
}
echo 'env_backup=' . (file_exists($sharedRoot . '/.env') ? 'yes' : 'no') . "\n";

$storageOk = false;
$publicStorage = $backendRoot.'/public/storage';
$appPublic = $backendRoot.'/storage/app/public';

if (is_link($publicStorage) || is_dir($publicStorage)) {
    $storageOk = is_dir($appPublic)
        || is_dir($publicStorage)
        || @is_readable($publicStorage);
}

if (! $storageOk && is_dir($appPublic)) {
    $resolved = @realpath($appPublic);
    $storageOk = $resolved !== false && is_readable($resolved);
}

echo 'storage='.($storageOk ? 'yes' : 'no')."\n";

$db = 'no';
if (file_exists($backendRoot . '/vendor/autoload.php') && $envExists) {
    try {
        require $backendRoot . '/vendor/autoload.php';
        $app = require_once $backendRoot . '/bootstrap/app.php';
        $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
        Illuminate\Support\Facades\DB::connection()->getPdo();
        $db = 'yes';
    } catch (Throwable) {
        $db = 'no';
    }
}
echo 'db=' . $db . "\n";

$repoRoot = dirname($backendRoot);
if (is_dir($repoRoot . '/.git')) {
    $head = @trim((string) @file_get_contents($repoRoot . '/.git/HEAD'));
    if (str_starts_with($head, 'ref: ')) {
        $ref = substr($head, 5);
        $hash = @trim((string) @file_get_contents($repoRoot . '/.git/' . $ref));
        if ($hash !== '') {
            echo 'git=' . substr($hash, 0, 7) . "\n";
        }
    } elseif ($head !== '') {
        echo 'git=' . substr($head, 0, 7) . "\n";
    }
}
