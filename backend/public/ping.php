<?php
// Health probe — https://deliverexapp.com/ping.php
header('Content-Type: text/plain');
echo "pong\n";
echo 'php=' . PHP_VERSION . "\n";
echo 'env=' . (file_exists(__DIR__ . '/../.env') ? 'yes' : 'no') . "\n";
echo 'vendor=' . (file_exists(__DIR__ . '/../vendor/autoload.php') ? 'yes' : 'no') . "\n";

$backup = dirname(__DIR__, 2) . '/.deliverex.env';
if (! file_exists($backup)) {
    $backup = dirname(__DIR__, 3) . '/.deliverex.env';
}
echo 'env_backup=' . (file_exists($backup) ? 'yes' : 'no') . "\n";

$repoRoot = dirname(__DIR__, 2);
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
