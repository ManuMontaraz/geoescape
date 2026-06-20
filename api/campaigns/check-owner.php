<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';

header('Content-Type: application/json');

$response = ['success' => false, 'isOwner' => false, 'isPublic' => false];

$uuid = $_GET['uuid'] ?? '';

if (empty($uuid)) {
    $response['error'] = 'UUID is required';
    echo json_encode($response);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    $response['error'] = 'Not authenticated';
    echo json_encode($response);
    exit;
}

$stmt = $pdo->prepare("SELECT user_id, is_public FROM campaigns WHERE uuid = ?");
$stmt->execute([$uuid]);
$campaign = $stmt->fetch();

if (!$campaign) {
    $response['error'] = 'Campaign not found';
    echo json_encode($response);
    exit;
}

$response['success'] = true;
$response['isOwner'] = ($campaign['user_id'] == $_SESSION['user_id']);
$response['isPublic'] = (bool)$campaign['is_public'];

echo json_encode($response);
