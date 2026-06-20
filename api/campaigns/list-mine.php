<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';

$response = ['success' => false, 'campaigns' => []];

if (!isset($_SESSION['user_id'])) {
    $response['error'] = 'Not authenticated';
    echo json_encode($response);
    exit;
}

$userId = $_SESSION['user_id'];

$stmt = $pdo->prepare("SELECT c.uuid, c.campaign_id, c.title, c.description, u.username as author, c.gps_type, c.is_public, c.vote_count, c.created_at, c.updated_at FROM campaigns c JOIN users u ON c.user_id = u.id WHERE c.user_id = ? ORDER BY c.updated_at DESC");
$stmt->execute([$userId]);
$campaigns = $stmt->fetchAll();

$response['success'] = true;
$response['campaigns'] = $campaigns;

echo json_encode($response);
