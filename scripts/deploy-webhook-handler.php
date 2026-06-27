<?php
/**
 * CI deploy webhook — downloads artifact via PHP (no shell), queues deploy for cron CLI.
 */
declare(strict_types=1);

if (! headers_sent()) {
    header('Content-Type: text/plain; charset=utf-8');
}

$repoRoot = dirname(__DIR__);
$runId = trim((string) ($_POST['run_id'] ?? $_GET['run_id'] ?? ''));
$sha = trim((string) ($_POST['sha'] ?? $_GET['sha'] ?? ''));
$repo = trim((string) ($_POST['repo'] ?? $_GET['repo'] ?? 'taduranmiggy/deliverex'));
$token = (string) ($_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? '');

if ($runId === '' || ! ctype_digit($runId)) {
    http_response_code(400);
    echo "run_id required\n";
    exit;
}

$secrets = loadDeploySecrets($repoRoot);
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

$workDir = '/tmp/deliverex-deploy';
@mkdir($workDir, 0755, true);
$zipPath = $workDir . '/artifact-' . $runId . '.zip';
$bundlePath = $workDir . '/deliverex-deploy.tar.gz';

try {
    $artifactId = resolveDeployArtifactId($repo, $runId, $githubToken);
    downloadDeployGithubFile(
        "https://api.github.com/repos/{$repo}/actions/artifacts/{$artifactId}/zip",
        $githubToken,
        $zipPath
    );
    extractDeployTarballFromZip($zipPath, $bundlePath);
    @unlink($zipPath);

    if (! is_file($bundlePath)) {
        throw new RuntimeException('deliverex-deploy.tar.gz missing after artifact extract');
    }

    $stateDir = dirname($repoRoot) . '/shared/deploy-state';
    @mkdir($stateDir, 0755, true);
    $pendingFile = $stateDir . '/pending-deploy.json';
    $payload = json_encode([
        'bundle' => $bundlePath,
        'sha' => $sha !== '' ? $sha : 'unknown',
        'run_id' => $runId,
        'repo' => $repo,
        'app_url' => $secrets['APP_URL'] ?? 'https://deliverexapp.com',
        'queued_at' => gmdate('c'),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

    if ($payload === false) {
        throw new RuntimeException('failed to encode pending deploy payload');
    }

    $tmp = $pendingFile . '.tmp';
    if (file_put_contents($tmp, $payload) === false) {
        throw new RuntimeException('failed to write pending deploy file');
    }
    if (! rename($tmp, $pendingFile)) {
        throw new RuntimeException('failed to finalize pending deploy file');
    }

    http_response_code(202);
    echo "deploy queued run_id={$runId} sha={$sha}\n";
    echo "pending={$pendingFile}\n";
    echo "cron applies within 1 minute (scripts/process-deploy-queue.sh)\n";
} catch (Throwable $e) {
    http_response_code(500);
    echo 'deploy error: ' . $e->getMessage() . "\n";
    exit(1);
}

/** @return array<string, string> */
function loadDeploySecrets(string $repoRoot): array
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

function resolveDeployArtifactId(string $repo, string $runId, string $githubToken): int
{
    $url = "https://api.github.com/repos/{$repo}/actions/runs/{$runId}/artifacts?per_page=100";
    $json = deployGithubApiGet($url, $githubToken);
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

function deployGithubApiGet(string $url, string $githubToken): string
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

function downloadDeployGithubFile(string $url, string $githubToken, string $dest): void
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

function extractDeployTarballFromZip(string $zipPath, string $bundlePath): void
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
