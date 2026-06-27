<?php
/**
 * CI deploy webhook — direct PHP entry (bypasses Laravel when this file exists on disk).
 */
declare(strict_types=1);

require dirname(__DIR__, 2) . '/scripts/deploy-webhook-handler.php';
