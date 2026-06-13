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

if (empty($uuid)) {
    $response['error'] = 'UUID is required';
    echo json_encode($response);
    exit;
}

$userId = $_SESSION['user_id'];

// Verify ownership
$stmt = $pdo->prepare("SELECT id, user_id FROM campaigns WHERE uuid = ?");
$stmt->execute([$uuid]);
$campaign = $stmt->fetch();

if (!$campaign) {
    $response['error'] = 'Campaign not found';
    echo json_encode($response);
    exit;
}

if ($campaign['user_id'] != $userId) {
    $response['error'] = 'Not authorized';
    echo json_encode($response);
    exit;
}

$stmt = $pdo->prepare("DELETE FROM campaigns WHERE uuid = ?");
$stmt->execute([$uuid]);

$response['success'] = true;
$response['message'] = 'Campaign deleted successfully';

echo json_encode($response);
