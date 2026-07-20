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

$geocoding = 'no';
if ($db === 'yes' && isset($app)) {
    try {
        foreach ($app->make('router')->getRoutes() as $route) {
            if (str_contains((string) $route->uri(), 'geocoding/autocomplete')) {
                $geocoding = 'yes';
                break;
            }
        }
    } catch (Throwable) {
        $geocoding = 'no';
    }
}
echo 'geocoding=' . $geocoding . "\n";

$currentShaFile = $sharedRoot . '/deploy-state/current-sha';
$deploySha = '';
if (is_readable($currentShaFile)) {
    $deploySha = trim((string) file_get_contents($currentShaFile));
    if ($deploySha === 'none' || $deploySha === 'unknown') {
        $deploySha = '';
    }
}

$pendingFile = $sharedRoot . '/deploy-state/pending-deploy.json';
if (is_readable($pendingFile)) {
    $pending = json_decode((string) file_get_contents($pendingFile), true);
    $pendingSha = is_array($pending) ? trim((string) ($pending['sha'] ?? '')) : '';
    if ($pendingSha !== '' && $pendingSha !== 'unknown') {
        echo 'deploy_pending=' . substr($pendingSha, 0, 7) . "\n";
    }
}

$errorFile = $sharedRoot . '/deploy-state/last-deploy-error.txt';
if (is_readable($errorFile)) {
    $errorLines = file($errorFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $lastLine = is_array($errorLines) ? trim((string) end($errorLines)) : '';
    if ($lastLine !== '') {
        echo 'deploy_error=' . substr($lastLine, 0, 200) . "\n";
    }
}

if ($deploySha !== '') {
    echo 'version=' . substr($deploySha, 0, 7) . "\n";
    echo 'deploy=' . substr($deploySha, 0, 7) . "\n";
}

$repoRoot = dirname($backendRoot);
$gitSha = '';
if (is_dir($repoRoot . '/.git')) {
    $head = @trim((string) @file_get_contents($repoRoot . '/.git/HEAD'));
    if (str_starts_with($head, 'ref: ')) {
        $ref = substr($head, 5);
        $hash = @trim((string) @file_get_contents($repoRoot . '/.git/' . $ref));
        if ($hash !== '') {
            $gitSha = $hash;
        }
    } elseif ($head !== '') {
        $gitSha = $head;
    }
}

// hPanel git clone is not updated by CI tarball deploys — only show when it matches live version.
if ($gitSha !== '') {
    $gitShort = substr($gitSha, 0, 7);
    $deployShort = $deploySha !== '' ? substr($deploySha, 0, 7) : '';
    if ($deployShort === '' || $gitShort === $deployShort) {
        echo 'git=' . $gitShort . "\n";
    } else {
        echo 'git_clone=' . $gitShort . "\n";
    }
}
