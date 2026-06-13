<?php
// GeoEscape - Environment Loader
// Safe .env parser that doesn't use parse_ini_file()

function loadEnv($path = __DIR__ . '/../.env') {
    $env = [];
    if (!file_exists($path)) {
        return $env;
    }
    
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        // Skip comments and empty lines
        if (empty($line) || $line[0] === '#') {
            continue;
        }
        
        // Parse KEY=VALUE
        $pos = strpos($line, '=');
        if ($pos === false) {
            continue;
        }
        
        $key = trim(substr($line, 0, $pos));
        $value = trim(substr($line, $pos + 1));
        
        // Remove surrounding quotes if present
        if (strlen($value) >= 2 && (($value[0] === '"' && $value[strlen($value)-1] === '"') || ($value[0] === "'" && $value[strlen($value)-1] === "'"))) {
            $value = substr($value, 1, -1);
        }
        
        $env[$key] = $value;
    }
    
    return $env;
}

// Helper to get env value
function env($key, $default = null) {
    static $env = null;
    if ($env === null) {
        $env = loadEnv();
    }
    return $env[$key] ?? $default;
}
