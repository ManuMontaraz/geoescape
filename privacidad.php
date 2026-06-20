<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

require_once __DIR__ . '/api/config/env.php';
$env = loadEnv(__DIR__ . '/api/.env');

$name = $env['LEGAL_NAME'] ?? 'Responsable del sitio';
$email = $env['LEGAL_EMAIL'] ?? '';
$domain = $env['LEGAL_DOMAIN'] ?? $_SERVER['HTTP_HOST'] ?? 'escape.manumontaraz.es';
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Política de Privacidad - GeoEscape</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css">
  <link rel="stylesheet" href="css/legal.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>Política de Privacidad</h1>
      <p><a href="index.html">← Volver a GeoEscape</a></p>
    </header>

    <h2>1. Responsable del Tratamiento</h2>
    <p>
      El responsable del tratamiento de sus datos personales es:
    </p>
    <ul>
      <li><strong>Identidad:</strong> <?php echo htmlspecialchars($name); ?></li>
      <li><strong>Correo electrónico:</strong> <?php echo htmlspecialchars($email); ?></li>
    </ul>

    <h2>2. Datos Personales que Recogemos</h2>
    <p>
      En GeoEscape recogemos los siguientes datos personales:
    </p>
    <ul>
      <li><strong>Datos de registro:</strong> nombre de usuario, dirección de correo electrónico, contraseña (almacenada de forma segura mediante hash).</li>
      <li><strong>Datos de casos:</strong> si creas y subes casos, almacenamos el título, descripción, contenido JSON y configuración de visibilidad.</li>
      <li><strong>Datos de votos:</strong> tu identificador de usuario asociado a las casos que has votado.</li>
      <li><strong>Datos técnicos:</strong> dirección IP, cookie de sesión (PHPSESSID), y navegador utilizado.</li>
    </ul>

    <h2>3. Finalidad del Tratamiento</h2>
    <p>
      Utilizamos sus datos personales para:
    </p>
    <ul>
      <li>Gestionar su cuenta de usuario y permitir el acceso al servicio.</li>
      <li>Permitir la creación, edición, almacenamiento y compartición de casos.</li>
      <li>Gestionar el sistema de votos de casos.</li>
      <li>Mantener la seguridad del servicio y prevenir fraudes.</li>
      <li>Contactarle en caso de incidencias relacionadas con su cuenta o casos.</li>
    </ul>

    <h2>4. Base Jurídica</h2>
    <p>
      La base jurídica para el tratamiento de sus datos es:
    </p>
    <ul>
      <li><strong>Ejecución de contrato:</strong> el registro y uso del servicio implica una relación contractual (términos de uso).</li>
      <li><strong>Consentimiento explícito:</strong> cuando marca una caso como "pública" para su distribución, usted consiente explícitamente su publicación.</li>
      <li><strong>Interés legítimo:</strong> mantenimiento de la seguridad y funcionamiento del servicio.</li>
    </ul>

    <h2>5. Uso de Geolocalización / GPS</h2>
    <p>
      <strong>IMPORTANTE:</strong> GeoEscape utiliza geolocalización del dispositivo (GPS) para el funcionamiento del juego. Sin embargo:
    </p>
    <ul>
      <li>La ubicación GPS se procesa <strong>exclusivamente en su navegador</strong> (cliente).</li>
      <li><strong>No enviamos sus coordenadas GPS al servidor</strong>. La ubicación nunca se almacena en nuestros servidores ni se comparte con terceros.</li>
      <li>La única excepción son las casos de tipo "absoluto": el creador de la caso introduce coordenadas fijas en el editor, pero estas son de la ubicación del juego, no del jugador.</li>
      <li>El permiso de GPS se solicita directamente a su navegador/dispositivo. Puede revocarlo en cualquier momento desde la configuración de su navegador.</li>
    </ul>

    <h2>6. Conservación de los Datos</h2>
    <p>
      Los datos se conservarán durante:
    </p>
    <ul>
      <li><strong>Datos de cuenta:</strong> mientras no solicite la eliminación de su cuenta.</li>
      <li><strong>Casos subidos:</strong> mientras no sean eliminados por usted o por incumplimiento de los términos.</li>
      <li><strong>Votos:</strong> asociados a casos activas; se eliminan si la caso se elimina.</li>
      <li><strong>Datos de sesión (cookies):</strong> se eliminan al cerrar el navegador.</li>
    </ul>

    <h2>7. Destinatarios y Terceros</h2>
    <p>
      GeoEscape no vende, alquila ni transfiere sus datos personales a terceros con fines comerciales. Los únicos servicios externos que utilizamos son:
    </p>
    <ul>
      <li><strong>Stripe:</strong> para procesar donaciones voluntarias. Usted es redirigido a la plataforma de Stripe; GeoEscape no accede a sus datos de pago.</li>
      <li><strong>OpenStreetMap:</strong> para mostrar mapas en el juego ( Leaflet). No transfiere datos personales.</li>
      <li><strong>cdnjs.cloudflare.com:</strong> para cargar la librería Font Awesome. Solo carga recursos estáticos.</li>
    </ul>

    <h2>8. Derechos del Usuario</h2>
    <p>
      De acuerdo con el Reglamento General de Protección de Datos (GDPR), usted tiene derecho a:
    </p>
    <ul>
      <li><strong>Acceso:</strong> conocer qué datos personales tenemos sobre usted.</li>
      <li><strong>Rectificación:</strong> solicitar la corrección de datos inexactos.</li>
      <li><strong>Supresión ("derecho al olvido"):</strong> solicitar la eliminación de sus datos y cuenta.</li>
      <li><strong>Oposición:</strong> oponerse al tratamiento de sus datos en determinadas circunstancias.</li>
      <li><strong>Limitación:</strong> solicitar la limitación del tratamiento.</li>
      <li><strong>Portabilidad:</strong> recibir sus datos en un formato estructurado y común.</li>
    </ul>
    <p>
      Para ejercer estos derechos, envíe un correo electrónico a <strong><?php echo htmlspecialchars($email); ?></strong> desde la dirección de correo asociada a su cuenta. Le responderemos en un plazo máximo de 30 días.
    </p>

    <h2>9. Seguridad de la Información</h2>
    <p>
      Implementamos medidas de seguridad técnicas y organizativas para proteger sus datos: contraseñas almacenadas con hash seguro (Argon2), conexiones HTTPS, cookies de sesión con atributos HttpOnly y Secure, y acceso restringido a la base de datos. Sin embargo, ningún sistema es 100% seguro; en caso de brecha de seguridad, le notificaremos conforme a la normativa aplicable.
    </p>

    <h2>10. Cambios en esta Política</h2>
    <p>
      Nos reservamos el derecho de modificar esta Política de Privacidad. Cualquier cambio será publicado en esta página y, si es significativo, se le notificará por correo electrónico o mediante un aviso en el sitio.
    </p>

    <div style="text-align:center;margin-top:2rem;">
      <a href="index.html">← Volver a GeoEscape</a>
    </div>
  </div>
  <script src="js/cookie-banner.js"></script>
</body>
</html>
