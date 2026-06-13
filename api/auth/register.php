<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/session.php';

$response = ['success' => false, 'error' => ''];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $response['error'] = 'Method not allowed';
    echo json_encode($response);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$username = trim($input['username'] ?? '');
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (empty($username) || empty($email) || empty($password)) {
    $response['error'] = 'All fields are required';
    echo json_encode($response);
    exit;
}

if (strlen($username) < 3 || strlen($username) > 50) {
    $response['error'] = 'Username must be between 3 and 50 characters';
    echo json_encode($response);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $response['error'] = 'Invalid email format';
    echo json_encode($response);
    exit;
}

if (strlen($password) < 8) {
    $response['error'] = 'Password must be at least 8 characters';
    echo json_encode($response);
    exit;
}

// Check if email or username already exists
$stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? OR username = ?");
$stmt->execute([$email, $username]);
if ($stmt->fetch()) {
    $response['error'] = 'Email or username already exists';
    echo json_encode($response);
    exit;
}

// Hash password
$passwordHash = password_hash($password, PASSWORD_ARGON2ID);

// Generate verification token
$verificationToken = bin2hex(random_bytes(32));

// Insert user
$stmt = $pdo->prepare("INSERT INTO users (username, email, password_hash, verification_token) VALUES (?, ?, ?, ?)");
$stmt->execute([$username, $email, $passwordHash, $verificationToken]);

// Send verification email
require_once __DIR__ . '/../config/env.php';
$env = loadEnv(__DIR__ . '/../.env');
require_once __DIR__ . '/../lib/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/../lib/PHPMailer/SMTP.php';
require_once __DIR__ . '/../lib/PHPMailer/Exception.php';

$mail = new PHPMailer\PHPMailer\PHPMailer(true);
$domain = $env['DOMAIN'] ?? 'scape.manumontaraz.es';

// Generate verification link
$verifyLink = "https://{$domain}/api/auth/verify.php?token=" . $verificationToken;

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
        <h1>¡Bienvenido a GeoEscape!</h1>
        <p>Hola <strong>{$username}</strong>,</p>
        <p>Gracias por registrarte. Para activar tu cuenta, haz clic en el siguiente botón:</p>
        <a href="{$verifyLink}" class="button">Verificar mi cuenta</a>
        <p>O copia este enlace en tu navegador:</p>
        <p style="word-break: break-all;">{$verifyLink}</p>
        <p>Este enlace expira en 24 horas.</p>
        <div class="footer">
            <p>GeoEscape Team</p>
            <p>{$domain}</p>
        </div>
    </div>
</body>
</html>
HTML;

try {
    $mail->isSMTP();
    $mail->Host = $env['SMTP_HOST'];
    $mail->SMTPAuth = true;
    $mail->Username = $env['SMTP_USER'];
    $mail->Password = $env['SMTP_PASS'];
    $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = (int)$env['SMTP_PORT'];
    
    $mail->setFrom($env['SMTP_FROM'], $env['SMTP_FROM_NAME']);
    $mail->addAddress($email, $username);
    $mail->isHTML(true);
    $mail->Subject = 'Verifica tu cuenta en GeoEscape';
    $mail->Body = $emailBody;
    $mail->AltBody = "Bienvenido a GeoEscape! Haz clic aquí para verificar: {$verifyLink}";
    
    $mail->send();
    
    $response['success'] = true;
    $response['message'] = 'Registration successful. Please check your email to verify your account.';
} catch (Exception $e) {
    $response['success'] = true;
    $response['message'] = 'Registration successful, but email could not be sent. Please contact support.';
    error_log("Email error: {$mail->ErrorInfo}");
}

echo json_encode($response);
