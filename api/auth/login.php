<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';

$response = ['success' => false, 'error' => ''];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $response['error'] = 'Method not allowed';
    echo json_encode($response);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';
$remember = (bool)($input['remember'] ?? false);

if (empty($email) || empty($password)) {
    $response['error'] = 'Email and password are required';
    echo json_encode($response);
    exit;
}

// Find user
$stmt = $pdo->prepare("SELECT id, username, email, password_hash, email_verified FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    $response['error'] = 'Invalid email or password';
    echo json_encode($response);
    exit;
}

if (!$user['email_verified']) {
    $response['error'] = 'Please verify your email before logging in';
    echo json_encode($response);
    exit;
}

// Update last login
$stmt = $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
$stmt->execute([$user['id']]);

// Set session
$_SESSION['user_id'] = $user['id'];
$_SESSION['username'] = $user['username'];
$_SESSION['email'] = $user['email'];
$_SESSION['logged_in'] = true;
$_SESSION['created'] = time();

if ($remember) {
    // Extend session cookie to 7 days
    $sessionLifetime = 604800;
    setcookie(session_name(), session_id(), [
        'expires' => time() + $sessionLifetime,
        'path' => '/',
        'domain' => $env['DOMAIN'] ?? '',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
    
    // Set remember token cookie (30 days)
    $token = bin2hex(random_bytes(32));
    $expires = time() + (86400 * 30);
    setcookie('remember_token', $token, [
        'expires' => $expires,
        'path' => '/',
        'domain' => $env['DOMAIN'] ?? '',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
    
    // Store hash in database
    $tokenHash = hash('sha256', $token);
    $stmt = $pdo->prepare("UPDATE users SET remember_token = ? WHERE id = ?");
    $stmt->execute([$tokenHash, $user['id']]);
} else {
    // Clear any existing remember token
    $stmt = $pdo->prepare("UPDATE users SET remember_token = NULL WHERE id = ?");
    $stmt->execute([$user['id']]);
}

$response['success'] = true;
$response['user'] = [
    'id' => $user['id'],
    'username' => $user['username'],
    'email' => $user['email']
];

// Remove sensitive data
unset($response['error']);

echo json_encode($response);
