<?php
/**
 * CI deploy webhook — server pulls bundle from GitHub Actions (no inbound SSH from CI).
 * POST with header X-Deploy-Token and body run_id + sha (+ optional repo).
 */
declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');

$repoRoot = dirname(__DIR__, 2);
$runId = trim((string) ($_POST['run_id'] ?? $_GET['run_id'] ?? ''));
$sha = trim((string) ($_POST['sha'] ?? $_GET['sha'] ?? ''));
$repo = trim((string) ($_POST['repo'] ?? $_GET['repo'] ?? 'taduranmiggy/deliverex'));
$token = (string) ($_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? '');

if ($runId === '' || ! ctype_digit($runId)) {
    http_response_code(400);
    echo "run_id required\n";
    exit;
}

$secrets = loadSecrets($repoRoot);
$expected = $secrets['DEPLOY_HOOK_TOKEN'] ?? '';

if ($expected === '' || $token === '' || ! hash_equals($expected, $token)) {
    http_response_code(403);
    echo "forbidden\n";
    exit;
}

$githubToken = $secrets['GITHUB_DEPLOY_TOKEN'] ?? '';
if ($githubToken === '') {
    http_response_code(500);
    echo "GITHUB_DEPLOY_TOKEN missing in shared/.deploy.secrets\n";
    exit;
}

if (! function_exists('exec') && ! function_exists('shell_exec')) {
    http_response_code(503);
    echo "shell disabled on host\n";
    exit;
}

$workDir = '/tmp/deliverex-deploy';
@mkdir($workDir, 0755, true);
$zipPath = $workDir . '/artifact-' . $runId . '.zip';
$bundlePath = $workDir . '/deliverex-deploy.tar.gz';

try {
    $artifactId = resolveArtifactId($repo, $runId, $githubToken);
    downloadGithubFile(
        "https://api.github.com/repos/{$repo}/actions/artifacts/{$artifactId}/zip",
        $githubToken,
        $zipPath
    );
    extractTarballFromZip($zipPath, $bundlePath);
    @unlink($zipPath);

    if (! is_file($bundlePath)) {
        throw new RuntimeException('deliverex-deploy.tar.gz missing after artifact extract');
    }

    extractTarPaths($bundlePath, $repoRoot, ['scripts', 'deployment.sh']);
    $deployScript = $repoRoot . '/scripts/deploy-from-ci.sh';
    if (! is_file($deployScript)) {
        throw new RuntimeException('deploy-from-ci.sh missing after bootstrap extract');
    }

    $logDir = dirname($repoRoot) . '/shared/deploy-logs';
    @mkdir($logDir, 0755, true);
    $logFile = $logDir . '/deploy-' . date('Ymd-His') . '-' . substr(preg_replace('/[^a-f0-9]/', '', $sha), 0, 7) . '.log';

    set_time_limit(0);
    ignore_user_abort(true);

    $env = implode(' ', [
        'DEPLOY_PATH=' . escapeshellarg($repoRoot),
        'DEPLOY_BUNDLE=' . escapeshellarg($bundlePath),
        'DEPLOY_SHA=' . escapeshellarg($sha !== '' ? $sha : 'unknown'),
        'APP_URL=' . escapeshellarg($secrets['APP_URL'] ?? 'https://deliverexapp.com'),
        'SKIP_HEALTH_CHECK=1',
    ]);

    $inner = 'cd ' . escapeshellarg($repoRoot)
        . ' && chmod +x scripts/*.sh deployment.sh 2>/dev/null'
        . ' && ' . $env . ' bash ' . escapeshellarg($deployScript) . ' 2>&1';

    echo "deploy running run_id={$runId} sha={$sha}\n";
    echo "log={$logFile}\n\n";

    passthru($inner . ' >> ' . escapeshellarg($logFile) . ' 2>&1', $code);

    if (is_readable($logFile)) {
        echo "\n--- deploy log tail ---\n";
        $lines = file($logFile, FILE_IGNORE_NEW_LINES) ?: [];
        echo implode("\n", array_slice($lines, -40)) . "\n";
    }

    if ($code !== 0) {
        http_response_code(500);
        echo "deploy failed exit={$code}\n";
        exit($code);
    }

    echo "deploy complete sha={$sha}\n";
} catch (Throwable $e) {
    http_response_code(500);
    echo 'deploy error: ' . $e->getMessage() . "\n";
    exit(1);
}

/** @return array<string, string> */
function loadSecrets(string $repoRoot): array
{
    $domainRoot = dirname($repoRoot);
    $candidates = [
        $domainRoot . '/shared/.deploy.secrets',
        $domainRoot . '/.deploy.secrets',
    ];

    $out = [];
    foreach ($candidates as $file) {
        if (! is_readable($file)) {
            continue;
        }
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || ! str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = array_map('trim', explode('=', $line, 2));
            $out[$key] = $value;
        }
    }

    return $out;
}

function resolveArtifactId(string $repo, string $runId, string $githubToken): int
{
    $url = "https://api.github.com/repos/{$repo}/actions/runs/{$runId}/artifacts?per_page=100";
    $json = githubApiGet($url, $githubToken);
    $data = json_decode($json, true);
    if (! is_array($data)) {
        throw new RuntimeException('invalid artifacts response');
    }

    foreach ($data['artifacts'] ?? [] as $artifact) {
        if (! is_array($artifact)) {
            continue;
        }
        $name = (string) ($artifact['name'] ?? '');
        if ($name === 'deliverex-deploy' || str_starts_with($name, 'deliverex-deploy-')) {
            return (int) $artifact['id'];
        }
    }

    throw new RuntimeException("artifact deliverex-deploy not found for run {$runId}");
}

function githubApiGet(string $url, string $githubToken): string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $githubToken,
            'Accept: application/vnd.github+json',
            'X-GitHub-Api-Version: 2022-11-28',
            'User-Agent: Deliverex-Deploy-Hook',
        ],
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($body === false || $code >= 400) {
        throw new RuntimeException("GitHub API {$code}: " . ($err ?: substr((string) $body, 0, 200)));
    }

    return (string) $body;
}

function downloadGithubFile(string $url, string $githubToken, string $dest): void
{
    $fp = fopen($dest, 'wb');
    if ($fp === false) {
        throw new RuntimeException("cannot write {$dest}");
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_FILE => $fp,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 600,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $githubToken,
            'Accept: application/vnd.github+json',
            'X-GitHub-Api-Version: 2022-11-28',
            'User-Agent: Deliverex-Deploy-Hook',
        ],
    ]);
    $ok = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    fclose($fp);

    if ($ok === false || $code >= 400) {
        @unlink($dest);
        throw new RuntimeException("artifact download failed HTTP {$code}: {$err}");
    }
}

function extractTarballFromZip(string $zipPath, string $bundlePath): void
{
    if (! class_exists('ZipArchive')) {
        throw new RuntimeException('ZipArchive PHP extension required');
    }

    $zip = new ZipArchive();
    if ($zip->open($zipPath) !== true) {
        throw new RuntimeException("cannot open {$zipPath}");
    }

    $found = false;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = $zip->getNameIndex($i);
        if ($name === false) {
            continue;
        }
        if (basename($name) === 'deliverex-deploy.tar.gz') {
            $contents = $zip->getFromIndex($i);
            if ($contents === false) {
                break;
            }
            file_put_contents($bundlePath, $contents);
            $found = true;
            break;
        }
    }
    $zip->close();

    if (! $found) {
        throw new RuntimeException('deliverex-deploy.tar.gz not found inside artifact zip');
    }
}

/** @param list<string> $paths */
function extractTarPaths(string $tarball, string $dest, array $paths): void
{
    $pathArgs = implode(' ', array_map('escapeshellarg', $paths));
    $cmd = 'tar -xzf ' . escapeshellarg($tarball) . ' -C ' . escapeshellarg($dest) . ' ' . $pathArgs;
    exec($cmd, $output, $code);
    if ($code !== 0) {
        throw new RuntimeException('tar extract failed: ' . implode("\n", $output));
    }
}
