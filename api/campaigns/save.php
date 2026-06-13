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
$uuid = $input['campaign_id'] ?? '';
$title = $input['title'] ?? '';
$description = $input['description'] ?? '';
$author = $_SESSION['username'] ?? 'Anónimo';
$campaignJson = $input['campaign_json'] ?? '';
$gpsType = $input['gps_type'] ?? 'relative';
$isPublic = (bool)($input['is_public'] ?? false);
$originLat = $input['origin_lat'] ?? null;
$originLng = $input['origin_lng'] ?? null;

if (empty($uuid) || empty($campaignJson)) {
    $response['error'] = 'Campaign UUID and JSON are required';
    echo json_encode($response);
    exit;
}

// Check if campaign has a finish_campaign action
$json = json_decode($campaignJson, true);
$hasFinish = false;

function searchFinish($arr) {
    if (!is_array($arr)) return false;
    foreach ($arr as $key => $val) {
        if ($key === 'type' && $val === 'finish_campaign') {
            return true;
        }
        if (is_array($val)) {
            if (searchFinish($val)) return true;
        }
    }
    return false;
}

if (searchFinish($json)) {
    $hasFinish = true;
}

if (!$hasFinish) {
    $response['error'] = 'La campaña debe tener al menos una acción "Terminar campaña" para poder subirse.';
    echo json_encode($response);
    exit;
}

$userId = $_SESSION['user_id'];

// Check if campaign already exists by UUID
$stmt = $pdo->prepare("SELECT id, user_id FROM campaigns WHERE uuid = ?");
$stmt->execute([$uuid]);
$existing = $stmt->fetch();

if ($existing) {
    // Verify ownership
    if ($existing['user_id'] != $userId) {
        $response['error'] = 'Campaign belongs to another user';
        echo json_encode($response);
        exit;
    }
    // Update existing
    $stmt = $pdo->prepare("UPDATE campaigns SET title = ?, description = ?, author = ?, campaign_json = ?, gps_type = ?, is_public = ?, origin_lat = ?, origin_lng = ?, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$title, $description, $author, $campaignJson, $gpsType, $isPublic ? 1 : 0, $originLat, $originLng, $existing['id']]);

    $response['success'] = true;
    $response['message'] = 'Campaign updated successfully';
    $response['uuid'] = $uuid;
} else {
    // Insert new
    $stmt = $pdo->prepare("INSERT INTO campaigns (uuid, user_id, campaign_id, title, description, author, campaign_json, gps_type, is_public, origin_lat, origin_lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$uuid, $userId, $uuid, $title, $description, $author, $campaignJson, $gpsType, $isPublic ? 1 : 0, $originLat, $originLng]);

    $response['success'] = true;
    $response['message'] = 'Campaign saved successfully';
    $response['uuid'] = $uuid;
}

echo json_encode($response);
