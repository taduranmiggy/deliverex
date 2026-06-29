<?php
/**
 * Maintenance: seed chatbot intents on production.
 * POST/GET https://deliverexapp.com/seed-chatbot.php
 * Header: X-Deploy-Token: <DEPLOY_HOOK_TOKEN from shared/.deploy.secrets>
 */
declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');

$repoRoot = dirname(__DIR__);
$token = (string) ($_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? $_GET['token'] ?? '');

$secretsFile = dirname($repoRoot) . '/shared/.deploy.secrets';
if (! is_readable($secretsFile)) {
    $secretsFile = dirname($repoRoot, 2) . '/shared/.deploy.secrets';
}

$expected = '';
if (is_readable($secretsFile)) {
    foreach (file($secretsFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if (str_starts_with($line, 'DEPLOY_HOOK_TOKEN=')) {
            $expected = trim(substr($line, strlen('DEPLOY_HOOK_TOKEN=')));
            break;
        }
    }
}

if ($expected === '' || $token === '' || ! hash_equals($expected, $token)) {
    http_response_code(403);
    echo "forbidden\n";
    exit;
}

$backendRoot = $repoRoot;
if (! file_exists($backendRoot . '/vendor/autoload.php')) {
    http_response_code(500);
    echo "vendor missing\n";
    exit;
}

try {
    require $backendRoot . '/vendor/autoload.php';
    $app = require_once $backendRoot . '/bootstrap/app.php';
    $kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
    $kernel->bootstrap();

    Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
    echo "migrate: ok\n";

    Illuminate\Support\Facades\Artisan::call('db:seed', [
        '--class' => 'Database\\Seeders\\ChatbotIntentSeeder',
        '--force' => true,
    ]);
    echo trim(Illuminate\Support\Facades\Artisan::output()) . "\n";

    $count = App\Models\ChatbotIntent::query()->count();
    echo "chatbot_intents={$count}\n";
    echo "seed complete\n";
} catch (Throwable $e) {
    http_response_code(500);
    echo 'seed error: ' . $e->getMessage() . "\n";
    exit(1);
}
