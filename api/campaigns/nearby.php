<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

require_once __DIR__ . '/../config/database.php';

$response = ['success' => false, 'campaigns' => [], 'error' => ''];

$lat = floatval($_GET['lat'] ?? 0);
$lng = floatval($_GET['lng'] ?? 0);
$radius = floatval($_GET['radius'] ?? 30); // km

if ($lat === 0 || $lng === 0) {
    $response['error'] = 'lat and lng are required';
    echo json_encode($response);
    exit;
}

// Haversine formula
$stmt = $pdo->prepare("
    SELECT uuid, campaign_id, title, description, author, gps_type, vote_count, origin_lat, origin_lng,
        (6371 * acos(
            cos(radians(?)) * cos(radians(origin_lat)) * cos(radians(origin_lng) - radians(?)) +
            sin(radians(?)) * sin(radians(origin_lat))
        )) AS distance
    FROM campaigns
    WHERE is_public = 1 AND gps_type = 'absolute' AND origin_lat IS NOT NULL AND origin_lng IS NOT NULL
    HAVING distance <= ?
    ORDER BY distance ASC, vote_count DESC
    LIMIT 50
");
$stmt->execute([$lat, $lng, $lat, $radius]);
$allCampaigns = $stmt->fetchAll();

// Group by rounded coordinates (±0.0001 ≈ 11m) and keep only the highest voted one per group
$campaigns = [];
$seen = [];
foreach ($allCampaigns as $c) {
    $key = round($c['origin_lat'], 4) . ',' . round($c['origin_lng'], 4);
    if (!isset($seen[$key])) {
        $seen[$key] = true;
        $campaigns[] = $c;
    }
}

$response['success'] = true;
$response['campaigns'] = $campaigns;

echo json_encode($response);
