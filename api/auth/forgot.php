<?php
require_once __DIR__ . '/../config/database.php';

$response = ['success' => false, 'error' => ''];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $response['error'] = 'Method not allowed';
    echo json_encode($response);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $response['error'] = 'Valid email is required';
    echo json_encode($response);
    exit;
}

// Find user
$stmt = $pdo->prepare("SELECT id, username FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    // Don't reveal if email exists or not for security
    $response['success'] = true;
    $response['message'] = 'If the email exists, a reset link has been sent.';
    echo json_encode($response);
    exit;
}

// Generate reset token
$token = bin2hex(random_bytes(32));
$expiresAt = gmdate('Y-m-d H:i:s', strtotime('+1 hour'));

// Store token
$stmt = $pdo->prepare("INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)");
$stmt->execute([$user['id'], $token, $expiresAt]);

// Send email
require_once __DIR__ . '/../config/env.php';
$env = loadEnv(__DIR__ . '/../.env');
require_once __DIR__ . '/../lib/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/../lib/PHPMailer/SMTP.php';
require_once __DIR__ . '/../lib/PHPMailer/Exception.php';

$domain = $env['DOMAIN'] ?? 'escape.manumontaraz.es';
$resetLink = "https://{$domain}/api/auth/reset.php?token=" . $token;

$emailBody = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background: #1a1a2e; color: #ecf0f1; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #16213e; padding: 30px; border-radius: 10px; border: 2px solid #e94560; }
        h1 { color: #e94560; }
        .button { display: inline-block; padding: 15px 30px; background: #e94560; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { margin-top: 30px; font-size: 12px; color: #bdc3c7; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Recuperación de Contraseña</h1>
        <p>Hola <strong>{$user['username']}</strong>,</p>
        <p>Hemos recibido una solicitud para restablecer tu contraseña. Haz clic en el siguiente botón:</p>
        <a href="{$resetLink}" class="button">Restablecer Contraseña</a>
        <p>O copia este enlace:</p>
        <p style="word-break: break-all;">{$resetLink}</p>
        <p>Este enlace expira en 1 hora.</p>
        <div class="footer">
            <p>GeoEscape Team</p>
            <p>{$domain}</p>
        </div>
    </div>
</body>
</html>
HTML;

try {
    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    $mail->CharSet = 'UTF-8';
    $mail->isSMTP();
    $mail->Host = $env['SMTP_HOST'];
    $mail->SMTPAuth = true;
    $mail->Username = $env['SMTP_USER'];
    $mail->Password = $env['SMTP_PASS'];
    $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = (int)$env['SMTP_PORT'];
    
    $mail->setFrom($env['SMTP_FROM'], $env['SMTP_FROM_NAME']);
    $mail->addAddress($email, $user['username']);
    $mail->isHTML(true);
    $mail->Subject = 'Recupera tu contraseña - GeoEscape';
    $mail->Body = $emailBody;
    $mail->AltBody = "Recuperación de contraseña: {$resetLink}";
    
    $mail->send();
} catch (Exception $e) {
    error_log("Password reset email error: {$mail->ErrorInfo}");
}

$response['success'] = true;
$response['message'] = 'If the email exists, a reset link has been sent.';

echo json_encode($response);
