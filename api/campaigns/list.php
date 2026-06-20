<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

require_once __DIR__ . '/../config/database.php';

$response = ['success' => false, 'campaigns' => []];

$gpsType = $_GET['gps_type'] ?? '';
$search = $_GET['search'] ?? '';
$sort = $_GET['sort'] ?? 'votes'; // votes, recent

$where = 'WHERE is_public = 1';
$params = [];

if ($gpsType) {
    $where .= ' AND gps_type = ?';
    $params[] = $gpsType;
}

if ($search) {
    $where .= ' AND (title LIKE ? OR campaign_id LIKE ?)';
    $params[] = "%$search%";
    $params[] = "%$search%";
}

$order = $sort === 'recent' ? 'updated_at DESC' : 'vote_count DESC';

$stmt = $pdo->prepare("SELECT uuid, campaign_id, title, description, author, gps_type, vote_count, created_at, updated_at FROM campaigns $where ORDER BY $order LIMIT 50");
$stmt->execute($params);
$campaigns = $stmt->fetchAll();

$response['success'] = true;
$response['campaigns'] = $campaigns;

echo json_encode($response);
