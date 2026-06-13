<?php
require_once __DIR__ . '/../config/database.php';

require_once __DIR__ . '/../config/env.php';
$env = loadEnv(__DIR__ . '/../.env');
$domain = $env['DOMAIN'] ?? 'escape.manumontaraz.es';
$baseUrl = "https://{$domain}";

// Override JSON header from database.php
header("Content-Type: text/html; charset=utf-8");

$token = $_GET['token'] ?? ($_POST['token'] ?? '');
$password = $_POST['password'] ?? '';
$passwordConfirm = $_POST['password_confirm'] ?? '';

$mode = 'form'; // form | success | error
$title = 'Restablecer Contraseña';
$message = '';
$subMessage = '';
$bgColor = '#e94560';
$bgDark = '#c0392b';
$icon = '🔐';
$buttonText = 'Volver al inicio';
$buttonHref = $baseUrl . '/index.html';
$redirectMeta = '';
$showForm = false;

// Validate token
if (empty($token)) {
    $mode = 'error';
    $message = 'Enlace inválido';
    $subMessage = 'No se proporcionó un token de recuperación.';
} else {
    // Find valid token
    $stmt = $pdo->prepare("
        SELECT pr.user_id, u.username, u.email 
        FROM password_resets pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.token = ? AND pr.used = FALSE AND pr.expires_at > UTC_TIMESTAMP()
        LIMIT 1
    ");
    $stmt->execute([$token]);
    $reset = $stmt->fetch();

    if (!$reset) {
        $mode = 'error';
        $message = 'Enlace inválido o expirado';
        $subMessage = 'El enlace de recuperación ya no es válido o ha sido usado.';
    } else {
        // Valid token
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            // Process password reset
            if (empty($password) || strlen($password) < 8) {
                $mode = 'error';
                $message = 'Contraseña inválida';
                $subMessage = 'La contraseña debe tener al menos 8 caracteres.';
                $showForm = true;
            } else if ($password !== $passwordConfirm) {
                $mode = 'error';
                $message = 'Las contraseñas no coinciden';
                $subMessage = 'Asegúrate de escribir la misma contraseña en ambos campos.';
                $showForm = true;
            } else {
                // Success - update password
                $passwordHash = password_hash($password, PASSWORD_ARGON2ID);
                
                // Update password
                $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
                $stmt->execute([$passwordHash, $reset['user_id']]);
                
                // Mark token as used
                $stmt = $pdo->prepare("UPDATE password_resets SET used = TRUE WHERE token = ?");
                $stmt->execute([$token]);
                
                $mode = 'success';
                $title = 'Contraseña Restablecida';
                $message = '✅ Contraseña restablecida';
                $subMessage = 'Tu contraseña ha sido actualizada correctamente. Redirigiendo...';
                $bgColor = '#27ae60';
                $bgDark = '#1e8449';
                $icon = '✅';
                $buttonText = 'Ir al inicio';
                $redirectMeta = '<meta http-equiv="refresh" content="3;url=' . $baseUrl . '/index.html">';
            }
        } else {
            // GET - show form
            $showForm = true;
            $mode = 'form';
            $title = 'Restablecer Contraseña';
            $message = '🔐 Restablecer Contraseña';
            $subMessage = 'Hola ' . htmlspecialchars($reset['username']) . ', introduce tu nueva contraseña.';
        }
    }
}

?><!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php echo $redirectMeta; ?>
    <title><?php echo $title; ?> - GeoEscape</title>
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
            box-shadow: 0 0 40px rgba(<?php echo ($mode === 'success') ? '39, 174, 96' : (($mode === 'error') ? '231, 76, 60' : '233, 69, 96'); ?>, 0.3);
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
            box-shadow: 0 0 20px rgba(<?php echo ($mode === 'success') ? '39, 174, 96' : (($mode === 'error') ? '231, 76, 60' : '233, 69, 96'); ?>, 0.5);
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
            box-shadow: 0 4px 15px rgba(<?php echo ($mode === 'success') ? '39, 174, 96' : (($mode === 'error') ? '231, 76, 60' : '233, 69, 96'); ?>, 0.4);
            width: 100%;
        }
        
        .verify-btn:hover {
            background: <?php echo $bgDark; ?>;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(<?php echo ($mode === 'success') ? '39, 174, 96' : (($mode === 'error') ? '231, 76, 60' : '233, 69, 96'); ?>, 0.6);
        }
        
        .verify-btn:active {
            transform: translateY(0);
        }
        
        .form-group {
            margin-bottom: 1.5rem;
            text-align: left;
        }
        
        .form-group label {
            display: block;
            color: var(--text-muted, #bdc3c7);
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
        }
        
        .form-group input {
            width: 100%;
            padding: 0.8rem;
            background: rgba(0, 0, 0, 0.3);
            border: 2px solid var(--accent, #e94560);
            border-radius: 8px;
            color: var(--text, #ecf0f1);
            font-size: 1rem;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: <?php echo $bgColor; ?>;
            box-shadow: 0 0 10px rgba(<?php echo ($mode === 'success') ? '39, 174, 96' : (($mode === 'error') ? '231, 76, 60' : '233, 69, 96'); ?>, 0.3);
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
            
            <?php if ($showForm): ?>
            <form method="POST" action="" onsubmit="return validateForm()">
                <input type="hidden" name="token" value="<?php echo htmlspecialchars($token); ?>">
                
                <div class="form-group">
                    <label for="password">🔐 Nueva contraseña</label>
                    <input type="password" id="password" name="password" required minlength="8" placeholder="Mínimo 8 caracteres">
                </div>
                
                <div class="form-group">
                    <label for="password_confirm">🔐 Confirmar contraseña</label>
                    <input type="password" id="password_confirm" name="password_confirm" required minlength="8" placeholder="Repite la contraseña">
                </div>
                
                <button type="submit" class="verify-btn">Restablecer Contraseña</button>
            </form>
            
            <script>
                function validateForm() {
                    const password = document.getElementById('password').value;
                    const confirm = document.getElementById('password_confirm').value;
                    
                    if (password.length < 8) {
                        alert('La contraseña debe tener al menos 8 caracteres.');
                        return false;
                    }
                    
                    if (password !== confirm) {
                        alert('Las contraseñas no coinciden.');
                        return false;
                    }
                    
                    return true;
                }
            </script>
            <?php else: ?>
            <a href="<?php echo $buttonHref; ?>" class="verify-btn">
                <?php echo $buttonText; ?>
            </a>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
