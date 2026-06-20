<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';

$response = ['success' => false, 'error' => ''];

// Check if user is logged in
if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
    $response['error'] = 'Not authenticated';
    http_response_code(401);
    echo json_encode($response);
    exit;
}

// Get user data
$stmt = $pdo->prepare("SELECT id, username, email, created_at, last_login FROM users WHERE id = ?");
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch();

if (!$user) {
    $response['error'] = 'User not found';
    http_response_code(404);
    echo json_encode($response);
    exit;
}

$response['success'] = true;
$response['user'] = [
    'id' => $user['id'],
    'username' => $user['username'],
    'email' => $user['email'],
    'created_at' => $user['created_at'],
    'last_login' => $user['last_login']
];

// Remove sensitive data
unset($response['error']);

echo json_encode($response);
