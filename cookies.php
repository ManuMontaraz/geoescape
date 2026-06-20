<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

require_once __DIR__ . '/api/config/env.php';
$env = loadEnv(__DIR__ . '/api/.env');

$domain = $env['LEGAL_DOMAIN'] ?? $_SERVER['HTTP_HOST'] ?? 'escape.manumontaraz.es';
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Política de Cookies - GeoEscape</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css">
  <link rel="stylesheet" href="css/legal.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>Política de Cookies</h1>
      <p><a href="index.html">← Volver a GeoEscape</a></p>
    </header>

    <h2>1. ¿Qué son las cookies?</h2>
    <p>
      Las cookies son pequeños archivos de texto que se almacenan en su dispositivo cuando visita un sitio web. Sirven para recordar información sobre su visita, como su idioma preferido o su sesión de usuario, para que la próxima vez que visite el sitio sea más útil.
    </p>

    <h2>2. Cookies que utilizamos</h2>
    <p>
      En <strong><?php echo htmlspecialchars($domain); ?></strong> utilizamos exclusivamente cookies técnicas y necesarias para el funcionamiento del sitio:
    </p>

    <table style="width:100%; border-collapse: collapse; margin: 1rem 0;">
      <thead>
        <tr style="border-bottom: 2px solid #e94560;">
          <th style="text-align: left; padding: 0.5rem;">Cookie</th>
          <th style="text-align: left; padding: 0.5rem;">Tipo</th>
          <th style="text-align: left; padding: 0.5rem;">Finalidad</th>
          <th style="text-align: left; padding: 0.5rem;">Duración</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
          <td style="padding: 0.5rem;">PHPSESSID</td>
          <td style="padding: 0.5rem;">Técnica / Sesión</td>
          <td style="padding: 0.5rem;">Mantener la sesión de usuario iniciada. Necesaria para el login, el editor y la gestión de casos en la nube.</td>
          <td style="padding: 0.5rem;">Sesión del navegador</td>
        </tr>
      </tbody>
    </table>

    <h2>3. ¿Usamos cookies de terceros o de análisis?</h2>
    <p>
      <strong>No.</strong> GeoEscape no utiliza cookies de análisis (Google Analytics), cookies de publicidad, ni cookies de redes sociales. No rastreamos su actividad de navegación fuera de nuestro sitio.
    </p>
    <p>
      Las únicas cookies técnicas son gestionadas directamente por nuestro servidor. No compartimos datos con terceros para fines de marketing o profiling.
    </p>

    <h2>4. ¿Cómo gestionar las cookies?</h2>
    <p>
      Puede configurar su navegador para aceptar, rechazar o eliminar cookies. Tenga en cuenta que si desactiva las cookies técnicas, es posible que no pueda iniciar sesión ni utilizar el editor de casos.
    </p>
    <p>
      Enlaces para gestionar cookies en los navegadores más comunes:
    </p>
    <ul>
      <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener">Google Chrome</a></li>
      <li><a href="https://support.mozilla.org/es/kb/Borrar%20cookies" target="_blank" rel="noopener">Mozilla Firefox</a></li>
      <li><a href="https://support.microsoft.com/es-es/help/17442/windows-internet-explorer-delete-manage-cookies" target="_blank" rel="noopener">Internet Explorer</a></li>
      <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener">Safari</a></li>
    </ul>

    <h2>5. Más información</h2>
    <p>
      Para más información sobre el tratamiento de sus datos personales, consulte nuestra <a href="privacidad.php">Política de Privacidad</a>.
    </p>

    <div style="text-align:center;margin-top:2rem;">
      <a href="index.html">← Volver a GeoEscape</a>
    </div>
  </div>
  <script src="js/cookie-banner.js"></script>
</body>
</html>
