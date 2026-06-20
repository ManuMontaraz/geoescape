<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

require_once __DIR__ . '/api/config/env.php';
$env = loadEnv(__DIR__ . '/api/.env');

$name = $env['LEGAL_NAME'] ?? 'Responsable del sitio';
$dni = $env['LEGAL_DNI'] ?? '';
$address = $env['LEGAL_ADDRESS'] ?? '';
$email = $env['LEGAL_EMAIL'] ?? '';
$phone = $env['LEGAL_PHONE'] ?? '';
$domain = $env['LEGAL_DOMAIN'] ?? $_SERVER['HTTP_HOST'] ?? 'escape.manumontaraz.es';
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Aviso Legal - GeoEscape</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css">
  <link rel="stylesheet" href="css/legal.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>Aviso Legal</h1>
      <p>Última actualización: <?php echo date('Y'); ?></p>
      <p><a href="index.html">← Volver a GeoEscape</a></p>
    </header>

    <h2>1. Identificación del Responsable</h2>
    <p>
      De conformidad con el artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y Comercio Electrónico (LSSI), se informa que:
    </p>
    <ul>
      <li><strong>Titular:</strong> <?php echo htmlspecialchars($name); ?></li>
      <li><strong>DNI:</strong> <?php echo htmlspecialchars($dni); ?></li>
      <li><strong>Domicilio:</strong> <?php echo htmlspecialchars($address); ?></li>
      <li><strong>Correo electrónico:</strong> <?php echo htmlspecialchars($email); ?></li>
      <li><strong>Teléfono:</strong> <?php echo htmlspecialchars($phone); ?></li>
      <li><strong>Dominio:</strong> <?php echo htmlspecialchars($domain); ?></li>
    </ul>

    <h2>2. Objeto del Sitio Web</h2>
    <p>
      GeoEscape es un juego de escape room basado en GPS. El sitio permite a los usuarios jugar casos de escape room, crear casos propias mediante el editor, y compartirlas con otros usuarios. El servicio es gratuito y no requiere registro obligatorio para jugar, aunque el registro es necesario para acceder al editor de casos y para subir casos a la nube.
    </p>

    <h2>3. Condiciones de Uso</h2>
    <p>
      El uso de este sitio web implica la aceptación de los siguientes términos:
    </p>
    <ul>
      <li>El usuario se compromete a utilizar el sitio de forma lícita, conforme a la moral, buenas costumbres y orden público.</li>
      <li>El usuario se abstendrá de realizar actividades ilícitas, contrarias a la legalidad vigente o que puedan suponer una infracción de derechos de terceros.</li>
      <li>El titular se reserva el derecho de suspender o retirar el acceso a usuarios que incumplan estas condiciones.</li>
    </ul>

    <h2>4. Propiedad Intelectual e Industrial</h2>
    <p>
      Los contenidos de este sitio web (textos, imágenes, código, diseño, etc.) están protegidos por derechos de propiedad intelectual. El usuario puede descargar, visualizar e imprimir el contenido para uso personal y privado, pero no puede reproducirlo, distribuirlo o comunicarlo públicamente sin autorización expresa.
    </p>
    <p>
      Las casos creadas por los usuarios mantienen la propiedad intelectual de sus respectivos creadores, quienes ceden a GeoEscape una licencia no exclusiva para almacenar y distribuir dichas casos según las condiciones establecidas en los <a href="terminos.php">Términos y Condiciones</a>.
    </p>

    <h2>5. Licencia del Software</h2>
    <p>
      El código fuente de GeoEscape está licenciado bajo la <strong>GNU Affero General Public License v3.0 o posterior (AGPL-3.0+)</strong>. Esto significa que:
    </p>
    <ul>
      <li>El software es libre y de código abierto. Puede consultar, descargar y redistribuir el código fuente.</li>
      <li>Cualquier modificación o trabajo derivado que se ejecute en un servidor accesible públicamente debe publicarse también bajo AGPL v3.0 o posterior.</li>
      <li>El código fuente completo está disponible en el repositorio público del proyecto: <a href="https://github.com/ManuMontaraz/geoescape" target="_blank" rel="noopener">https://github.com/ManuMontaraz/geoescape</a>.</li>
      <li>Para más información, consulte <a href="LICENSE.md" target="_blank">LICENSE.md</a> o <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener">https://www.gnu.org/licenses/agpl-3.0.html</a>.</li>
    </ul>
    <p>
      <em>Copyright &copy; 2026 Manuel Arjona Blanco.</em>
    </p>

    <h2>6. Exclusión de Responsabilidad</h2>
    <p>
      El titular no se hace responsable de:
    </p>
    <ul>
      <li>Los contenidos generados por los usuarios (casos, descripciones, etc.). El creador es el único responsable de su contenido.</li>
      <li>Los daños derivados del uso incorrecto del sitio o de la imposibilidad de acceder al mismo.</li>
      <li>Los contenidos de sitios web enlazados desde GeoEscape.</li>
    </ul>

    <h2>7. Donaciones</h2>
    <p>
      GeoEscape solicita donaciones voluntarias a través de enlaces de Stripe. El usuario es redirigido a la plataforma de Stripe para completar el pago. El titular no procesa, almacena ni tiene acceso a los datos de pago del usuario (tarjetas, cuentas bancarias, etc.). Stripe opera bajo sus propios términos y condiciones de uso. Las donaciones no otorgan derechos adicionales sobre el servicio ni sobre el contenido generado por otros usuarios.
    </p>

    <h2>8. Legislación Aplicable y Jurisdicción</h2>
    <p>
      Este Aviso Legal se rige por la legislación española. Cualquier controversia que pudiera derivarse del acceso o uso de este sitio web será sometida a la jurisdicción de los Juzgados y Tribunales de Valencia, España.
    </p>

    <div style="text-align:center;margin-top:2rem;">
      <a href="index.html">← Volver a GeoEscape</a>
    </div>
  </div>
  <script src="js/cookie-banner.js"></script>
</body>
</html>
