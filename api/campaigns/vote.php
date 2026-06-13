<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';

$response = ['success' => false, 'error' => ''];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $response['error'] = 'Method not allowed';
    echo json_encode($response);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    $response['error'] = 'Not authenticated';
    echo json_encode($response);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$uuid = $input['uuid'] ?? '';
$voteType = $input['vote_type'] ?? '';

if (empty($uuid) || !in_array($voteType, ['up', 'down'])) {
    $response['error'] = 'UUID and valid vote_type (up/down) are required';
    echo json_encode($response);
    exit;
}

$userId = $_SESSION['user_id'];

// Get campaign ID
$stmt = $pdo->prepare("SELECT id, is_public FROM campaigns WHERE uuid = ?");
$stmt->execute([$uuid]);
$campaign = $stmt->fetch();

if (!$campaign) {
    $response['error'] = 'Campaign not found';
    echo json_encode($response);
    exit;
}

if (!$campaign['is_public']) {
    $response['error'] = 'Cannot vote on private campaign';
    echo json_encode($response);
    exit;
}

$campaignId = $campaign['id'];

// Upsert vote
$stmt = $pdo->prepare("INSERT INTO campaign_votes (campaign_id, user_id, vote_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE vote_type = VALUES(vote_type)");
$stmt->execute([$campaignId, $userId, $voteType]);

// Recalculate vote_count
$stmt = $pdo->prepare("SELECT SUM(CASE WHEN vote_type = 'up' THEN 1 WHEN vote_type = 'down' THEN -1 ELSE 0 END) as vote_count FROM campaign_votes WHERE campaign_id = ?");
$stmt->execute([$campaignId]);
$voteCount = $stmt->fetch()['vote_count'] ?? 0;

$stmt = $pdo->prepare("UPDATE campaigns SET vote_count = ? WHERE id = ?");
$stmt->execute([$voteCount, $campaignId]);

$response['success'] = true;
$response['vote_count'] = $voteCount;

echo json_encode($response);
