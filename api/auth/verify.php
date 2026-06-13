<?php
require_once __DIR__ . '/../config/database.php';

$token = $_GET['token'] ?? '';
$success = false;
$message = '';
$subMessage = '';

// Override JSON header from database.php
header("Content-Type: text/html; charset=utf-8");

if (empty($token)) {
    $success = false;
    $message = 'Enlace inválido';
    $subMessage = 'No se proporcionó un token de verificación.';
} else {
    // Find user by verification token
    $stmt = $pdo->prepare("SELECT id, username FROM users WHERE verification_token = ? AND email_verified = FALSE");
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    
    if ($user) {
        // Mark as verified
        $stmt = $pdo->prepare("UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE id = ?");
        $stmt->execute([$user['id']]);
        
        $success = true;
        $message = '¡Cuenta verificada!';
        $subMessage = 'Tu email ha sido confirmado. Ahora puedes iniciar sesión.';
    } else {
        $success = false;
        $message = 'Enlace inválido o expirado';
        $subMessage = 'El token de verificación no es válido o ya ha sido usado.';
    }
}

require_once __DIR__ . '/../config/env.php';
$env = loadEnv(__DIR__ . '/../.env');
$domain = $env['DOMAIN'] ?? 'escape.manumontaraz.es';
$baseUrl = "https://{$domain}";

// Set colors based on state
$bgColor = $success ? '#27ae60' : '#e74c3c';
$bgDark = $success ? '#1e8449' : '#c0392b';
$icon = $success ? '✅' : '❌';
$buttonText = $success ? 'Ir al inicio' : 'Volver al inicio';
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $success ? 'Verificación Exitosa' : 'Verificación Fallida'; ?> - GeoEscape</title>
    <link rel="stylesheet" href="<?php echo $baseUrl; ?>/css/styles.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--bg-dark, #1a1a2e);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        
        .verify-container {
            text-align: center;
            max-width: 500px;
            width: 90%;
            padding: 2rem;
            position: relative;
        }
        
        .verify-card {
            background: var(--bg-panel, #16213e);
            border: 2px solid <?php echo $bgColor; ?>;
            border-radius: 16px;
            padding: 3rem 2rem;
            box-shadow: 0 0 40px rgba(<?php echo $success ? '39, 174, 96' : '231, 76, 60'; ?>, 0.3);
            animation: cardAppear 0.6s ease-out;
        }
        
        @keyframes cardAppear {
            from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .icon-circle {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: <?php echo $bgColor; ?>;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 2rem;
            font-size: 3rem;
            animation: iconPulse 2s ease-in-out infinite;
            box-shadow: 0 0 20px rgba(<?php echo $success ? '39, 174, 96' : '231, 76, 60'; ?>, 0.5);
        }
        
        @keyframes iconPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        .verify-title {
            color: <?php echo $bgColor; ?>;
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 1rem;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .verify-message {
            color: var(--text, #ecf0f1);
            font-size: 1.1rem;
            margin-bottom: 2rem;
            line-height: 1.6;
        }
        
        .verify-btn {
            display: inline-block;
            padding: 1rem 2.5rem;
            background: <?php echo $bgColor; ?>;
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
            font-size: 1.1rem;
            font-weight: bold;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(<?php echo $success ? '39, 174, 96' : '231, 76, 60'; ?>, 0.4);
        }
        
        .verify-btn:hover {
            background: <?php echo $bgDark; ?>;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(<?php echo $success ? '39, 174, 96' : '231, 76, 60'; ?>, 0.6);
        }
        
        .verify-btn:active {
            transform: translateY(0);
        }
        
        .particles {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: hidden;
            z-index: -1;
        }
        
        .particle {
            position: absolute;
            width: 4px;
            height: 4px;
            background: <?php echo $bgColor; ?>;
            border-radius: 50%;
            opacity: 0.5;
            animation: float 8s ease-in-out infinite;
        }
        
        @keyframes float {
            0%, 100% {
                transform: translateY(100vh) rotate(0deg);
                opacity: 0;
            }
            10% {
                opacity: 0.5;
            }
            90% {
                opacity: 0.5;
            }
            100% {
                transform: translateY(-100px) rotate(720deg);
                opacity: 0;
            }
        }
        
        .logo {
            font-size: 1.5rem;
            color: var(--accent, #e94560);
            margin-bottom: 2rem;
            font-weight: bold;
            letter-spacing: 2px;
        }
        
        @media (max-width: 480px) {
            .verify-card {
                padding: 2rem 1.5rem;
            }
            .verify-title {
                font-size: 1.5rem;
            }
            .icon-circle {
                width: 80px;
                height: 80px;
                font-size: 2.5rem;
            }
        }
    </style>
</head>
<body>
    <!-- Floating particles -->
    <div class="particles">
        <?php for ($i = 0; $i < 20; $i++): ?>
        <div class="particle" style="left: <?php echo rand(0, 100); ?>%; animation-delay: <?php echo rand(0, 8); ?>s; animation-duration: <?php echo rand(6, 12); ?>s;"></div>
        <?php endfor; ?>
    </div>
    
    <div class="verify-container">
        <div class="logo">GEOESCAPE</div>
        
        <div class="verify-card">
            <div class="icon-circle">
                <?php echo $icon; ?>
            </div>
            
            <h1 class="verify-title"><?php echo $message; ?></h1>
            
            <p class="verify-message">
                <?php echo $subMessage; ?>
            </p>
            
            <a href="<?php echo $baseUrl; ?>/index.html" class="verify-btn">
                <?php echo $buttonText; ?>
            </a>
        </div>
    </div>
</body>
</html>
