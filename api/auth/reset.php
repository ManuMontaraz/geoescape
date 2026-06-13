<?php
require_once __DIR__ . '/../config/database.php';

$response = ['success' => false, 'error' => ''];

// Support both GET (link click) and POST (form submission)
$token = $_GET['token'] ?? ($_POST['token'] ?? '');
$password = $_POST['password'] ?? '';

if (empty($token)) {
    $response['error'] = 'Token is required';
    echo json_encode($response);
    exit;
}

// Find valid token
$stmt = $pdo->prepare("
    SELECT pr.user_id, u.username, u.email 
    FROM password_resets pr
    JOIN users u ON pr.user_id = u.id
    WHERE pr.token = ? AND pr.used = FALSE AND pr.expires_at > NOW()
    LIMIT 1
");
$stmt->execute([$token]);
$reset = $stmt->fetch();

if (!$reset) {
    $response['error'] = 'Invalid or expired token';
    echo json_encode($response);
    exit;
}

// If GET request, just confirm token is valid
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $response['success'] = true;
    $response['message'] = 'Token valid. Please submit new password.';
    echo json_encode($response);
    exit;
}

// POST: Reset password
if (empty($password) || strlen($password) < 8) {
    $response['error'] = 'Password must be at least 8 characters';
    echo json_encode($response);
    exit;
}

$passwordHash = password_hash($password, PASSWORD_ARGON2ID);

// Update password
$stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
$stmt->execute([$passwordHash, $reset['user_id']]);

// Mark token as used
$stmt = $pdo->prepare("UPDATE password_resets SET used = TRUE WHERE token = ?");
$stmt->execute([$token]);

$response['success'] = true;
$response['message'] = 'Password reset successfully. You can now log in.';

echo json_encode($response);
