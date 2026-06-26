<?php
// Trigger server deploy from GitHub Actions (POST with X-Deploy-Token header).
// One-time: bash scripts/setup-hostinger-autodeploy.sh creates DEPLOY_HOOK_TOKEN.
declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');

$repoRoot = dirname(__DIR__, 2);
$secretsFile = dirname($repoRoot) . '/.deploy.secrets';
$token = $_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? '';

$expected = '';
if (is_readable($secretsFile)) {
    foreach (file($secretsFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || ! str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = array_map('trim', explode('=', $line, 2));
        if ($key === 'DEPLOY_HOOK_TOKEN') {
            $expected = $value;
            break;
        }
    }
}

if ($expected === '' || $token === '' || ! hash_equals($expected, $token)) {
    http_response_code(403);
    echo "forbidden\n";
    exit;
}

if (! function_exists('exec') && ! function_exists('shell_exec') && ! function_exists('passthru')) {
    http_response_code(503);
    echo "shell disabled — use hPanel cron: scripts/hostinger-cron-deploy.sh\n";
    exit;
}

$script = $repoRoot . '/scripts/hostinger-pull-and-deploy.sh';
if (! is_file($script)) {
    http_response_code(500);
    echo "deploy script missing\n";
    exit;
}

$cmd = 'bash ' . escapeshellarg($script) . ' 2>&1';
passthru($cmd, $code);
exit($code);
