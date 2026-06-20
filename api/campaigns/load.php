<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

require_once __DIR__ . '/../config/session.php';

$response = ['success' => false, 'error' => '', 'campaign' => null];

$uuid = $_GET['uuid'] ?? '';

if (empty($uuid)) {
    $response['error'] = 'UUID is required';
    echo json_encode($response);
    exit;
}

$stmt = $pdo->prepare("SELECT id, user_id, campaign_id, title, description, author, campaign_json, gps_type, is_public, vote_count, origin_lat, origin_lng FROM campaigns WHERE uuid = ?");
$stmt->execute([$uuid]);
$campaign = $stmt->fetch();

if (!$campaign) {
    $response['error'] = 'Campaign not found';
    echo json_encode($response);
    exit;
}

// All campaigns are accessible via UUID (private ones are hidden from listings but accessible with direct link)
$response['success'] = true;
$response['campaign'] = [
    'uuid' => $uuid,
    'campaign_id' => $campaign['campaign_id'],
    'title' => $campaign['title'],
    'description' => $campaign['description'],
    'author' => $campaign['author'],
    'campaign_json' => $campaign['campaign_json'],
    'gps_type' => $campaign['gps_type'],
    'vote_count' => $campaign['vote_count'],
    'origin_lat' => $campaign['origin_lat'],
    'origin_lng' => $campaign['origin_lng'],
    'is_public' => (bool)$campaign['is_public']
];

echo json_encode($response);
