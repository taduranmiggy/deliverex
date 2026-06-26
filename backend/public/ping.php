<?php
// Temporary probe — delete after site works. Visit: https://deliverexapp.com/ping.php
header('Content-Type: text/plain');
echo "pong\n";
echo 'php=' . PHP_VERSION . "\n";
echo 'env=' . (file_exists(__DIR__ . '/../.env') ? 'yes' : 'no') . "\n";
echo 'vendor=' . (file_exists(__DIR__ . '/../vendor/autoload.php') ? 'yes' : 'no') . "\n";
$backup = dirname(__DIR__, 3) . '/.deliverex.env';
echo 'env_backup=' . (file_exists($backup) ? 'yes' : 'no') . "\n";
