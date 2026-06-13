<?php
// GeoEscape - Session Configuration with MariaDB Storage
require_once __DIR__ . '/../config/database.php';

require_once __DIR__ . '/env.php';
$env = loadEnv(__DIR__ . '/../.env');

// Session configuration
$secure = (bool)($env['SESSION_SECURE'] ?? true);
$httponly = (bool)($env['SESSION_HTTPONLY'] ?? true);
$samesite = $env['SESSION_SAMESITE'] ?? 'Strict';
$sessionName = $env['SESSION_NAME'] ?? 'geoescape_session';

session_name($sessionName);

// Default session cookie: expires when browser closes (lifetime=0)
// If "remember me" is active, login.php will extend this to 7 days
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'domain' => $env['DOMAIN'] ?? '',
    'secure' => $secure,
    'httponly' => $httponly,
    'samesite' => $samesite
]);

// Custom session handler for MariaDB
class MariaDBSessionHandler implements SessionHandlerInterface {
    private $pdo;
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    
    public function open($savePath, $sessionName): bool {
        return true;
    }
    
    public function close(): bool {
        return true;
    }
    
    public function read($id): string {
        $stmt = $this->pdo->prepare("SELECT data FROM php_sessions WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? $row['data'] : '';
    }
    
    public function write($id, $data): bool {
        $stmt = $this->pdo->prepare("INSERT INTO php_sessions (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?, last_access = CURRENT_TIMESTAMP");
        return $stmt->execute([$id, $data, $data]);
    }
    
    public function destroy($id): bool {
        $stmt = $this->pdo->prepare("DELETE FROM php_sessions WHERE id = ?");
        return $stmt->execute([$id]);
    }
    
    public function gc($maxLifetime): int {
        $stmt = $this->pdo->prepare("DELETE FROM php_sessions WHERE last_access < DATE_SUB(NOW(), INTERVAL ? SECOND)");
        $stmt->execute([$maxLifetime]);
        return $stmt->rowCount();
    }
}

// Register custom session handler
$handler = new MariaDBSessionHandler($pdo);
session_set_save_handler($handler, true);

// Start session
session_start();

// Check remember token if no active session
if ((!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) && isset($_COOKIE['remember_token'])) {
    $tokenHash = hash('sha256', $_COOKIE['remember_token']);
    $stmt = $pdo->prepare("SELECT id, username, email FROM users WHERE remember_token = ? AND remember_token IS NOT NULL");
    $stmt->execute([$tokenHash]);
    $user = $stmt->fetch();
    if ($user) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['logged_in'] = true;
        $_SESSION['created'] = time();
    }
}

// Regenerate session ID periodically for security
if (isset($_SESSION['created']) && time() - $_SESSION['created'] > 3600) {
    session_regenerate_id(true);
    $_SESSION['created'] = time();
}
