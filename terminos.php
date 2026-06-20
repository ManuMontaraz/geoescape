<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

require_once __DIR__ . '/api/config/env.php';
$env = loadEnv(__DIR__ . '/api/.env');

$name = $env['LEGAL_NAME'] ?? 'Responsable del sitio';
$email = $env['LEGAL_EMAIL'] ?? '';
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Términos y Condiciones - GeoEscape</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css">
  <link rel="stylesheet" href="css/legal.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>Términos y Condiciones del Servicio</h1>
      <p><a href="index.html">← Volver a GeoEscape</a></p>
    </header>

    <h2>1. Aceptación de los Términos</h2>
    <p>
      Al registrarse, acceder o utilizar GeoEscape, usted acepta estos Términos y Condiciones. Si no está de acuerdo, no debe utilizar el servicio.
    </p>

    <h2>2. Descripción del Servicio</h2>
    <p>
      GeoEscape es una plataforma que permite:
    </p>
    <ul>
      <li>Jugar casos de escape room basadas en GPS.</li>
      <li>Crear y editar casos propias mediante el editor.</li>
      <li>Subir casos a la nube para compartirlas con otros usuarios.</li>
      <li>Descargar casos de otros usuarios para jugarlas.</li>
      <li>Valorar casos mediante un sistema de votos.</li>
    </ul>
    <p>
      El servicio es gratuito. No se requiere registro para jugar casos descargadas, pero sí es necesario para acceder al editor y subir casos.
    </p>

    <h2>3. Registro y Cuenta de Usuario</h2>
    <p>
      Para registrarse, debe proporcionar un nombre de usuario, una dirección de correo electrónico válida y una contraseña segura. Usted es responsable de:
    </p>
    <ul>
      <li>Mantener la confidencialidad de su contraseña.</li>
      <li>Todas las actividades que ocurran bajo su cuenta.</li>
      <li>Notificar cualquier uso no autorizado de su cuenta.</li>
    </ul>
    <p>
      Nos reservamos el derecho de suspender o eliminar cuentas que proporcionen información falsa, infrinjan estos términos o estén inactivas durante un período prolongado.
    </p>

    <h2>4. Edad Mínima</h2>
    <p>
      El servicio está dirigido a personas mayores de 16 años. Si usted es menor de 16 años, debe utilizar el servicio bajo la supervisión de un tutor legal. Al registrarse, declara que cumple con este requisito o que tiene el consentimiento de su tutor.
    </p>

    <h2>5. Contenido Generado por el Usuario (Casos)</h2>
    <p>
      Al crear y subir una caso, usted:
    </p>
    <ul>
      <li><strong>Mantiene la propiedad intelectual</strong> de su caso. Usted sigue siendo el propietario de los derechos de autor.</li>
      <li><strong>Cede una licencia no exclusiva</strong> a GeoEscape para almacenar, reproducir y distribuir su caso a través de la plataforma, según la configuración de visibilidad que elija (privada o pública).</li>
      <li><strong>Es responsable</strong> del contenido de su caso: textos, descripciones, imágenes, mecánicas y cualquier otro material incluido.</li>
    </ul>

    <h2>6. Contenido Prohibido</h2>
    <p>
      Queda estrictamente prohibido crear, subir o compartir casos que contengan:
    </p>
    <ul>
      <li>Contenido ilegal, violento, o que incite al odio o discriminación.</li>
      <li>Material sexualmente explícito o pornográfico.</li>
      <li>Contenido que vulnere derechos de propiedad intelectual de terceros.</li>
      <li>Información personal o datos privados de terceros sin su consentimiento.</li>
      <li>Spam, malware, virus o cualquier código malicioso.</li>
      <li>Contenido que promueva actividades peligrosas o ilegales en el mundo real.</li>
    </ul>

    <h2>7. Moderación y Eliminación</h2>
    <p>
      GeoEscape se reserva el derecho de:
    </p>
    <ul>
      <li>Revisar, moderar o eliminar casos que incumplan estos términos.</li>
      <li>Suspender o eliminar cuentas de usuarios que violen las normas.</li>
      <li>Convertir casos públicas a privadas si se detecta contenido inapropiado.</li>
      <li>Denegar el acceso al servicio sin previo aviso en caso de incumplimiento grave.</li>
    </ul>
    <p>
      Si encuentra una caso inapropiada, puede reportarla contactando a <?php echo htmlspecialchars($email); ?>.
    </p>

    <h2>8. Sistema de Votos</h2>
    <p>
      El sistema de votos permite a los usuarios valorar las casos públicas. Cada usuario puede votar una vez por caso. Los votos son anónimos públicamente (no se muestra el nombre del votante), pero se asocian a su cuenta internamente para evitar votos múltiples.
    </p>

    <h2>9. Donaciones</h2>
    <p>
      GeoEscape ofrece la posibilidad de realizar donaciones voluntarias a través de enlaces externos a Stripe:
    </p>
    <ul>
      <li>Las donaciones son <strong>completamente voluntarias</strong> y no son obligatorias para utilizar el servicio.</li>
      <li>GeoEscape no procesa, almacena ni tiene acceso a los datos de pago (tarjetas, cuentas bancarias, etc.). El pago se gestiona directamente en la plataforma de Stripe.</li>
      <li>Stripe opera bajo sus propios <a href="https://stripe.com/es/legal" target="_blank" rel="noopener">términos legales y política de privacidad</a>.</li>
      <li>Las donaciones <strong>no otorgan derechos adicionales</strong> sobre el servicio, el contenido ni las casos de otros usuarios.</li>
      <li>No se ofrece reembolso de donaciones, salvo que lo indique expresamente la ley aplicable.</li>
    </ul>

    <h2>10. Disponibilidad del Servicio</h2>
    <p>
      GeoEscape no garantiza la disponibilidad del servicio 24 horas al día, 7 días a la semana. Podemos realizar mantenimiento, actualizaciones o suspender el servicio temporalmente sin previo aviso. No nos hacemos responsables de cualquier daño derivado de la indisponibilidad del servicio.
    </p>

    <h2>11. Propiedad Intelectual de GeoEscape</h2>
    <p>
      El código, diseño, marca, logo y nombre "GeoEscape" son propiedad del titular. El usuario no puede utilizar estos elementos sin autorización expresa. Las casos creadas por los usuarios son propiedad de sus respectivos creadores, según lo establecido en el apartado 5.
    </p>
    <p>
      El <strong>código fuente</strong> de GeoEscape está licenciado bajo la <strong>GNU Affero General Public License v3.0 o posterior (AGPL-3.0+)</strong>. Esto significa que el software es libre y de código abierto: puede consultar, descargar, modificar y redistribuir el código, siempre que cualquier versión modificada que se ejecute en un servidor público también se publique bajo AGPL v3.0+. El código fuente completo está disponible en el repositorio público del proyecto: <a href="https://github.com/ManuMontaraz/geoescape" target="_blank" rel="noopener">https://github.com/ManuMontaraz/geoescape</a>. Para más información, consulte <a href="LICENSE.md" target="_blank">LICENSE.md</a> o <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener">https://www.gnu.org/licenses/agpl-3.0.html</a>.
    </p>
    <p>
      <em>Copyright &copy; 2026 Manuel Arjona Blanco.</em>
    </p>

    <h2>12. Limitación de Responsabilidad</h2>
    <p>
      GeoEscape no se hace responsable de:
    </p>
    <ul>
      <li>El contenido de las casos creadas por los usuarios.</li>
      <li>Los daños derivados del uso de la geolocalización o del juego en el mundo real (ej. lesiones, accidentes, etc.). El jugador es responsable de su propia seguridad.</li>
      <li>Pérdida de datos de casos o progreso de juego. Recomendamos guardar copias de seguridad de casos importantes.</li>
    </ul>

    <h2>13. Modificación de los Términos</h2>
    <p>
      Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán efectivos desde su publicación en esta página. Si los cambios son significativos, se notificará a los usuarios registrados por correo electrónico.
    </p>

    <h2>14. Ley Aplicable y Jurisdicción</h2>
    <p>
      Estos términos se rigen por la legislación española. Cualquier disputa será sometida a los Juzgados y Tribunales de Valencia, España.
    </p>

    <h2>15. Contacto</h2>
    <p>
      Para cualquier duda, reporte o solicitud relacionada con estos términos, contacte a:
    </p>
    <ul>
      <li><strong>Correo:</strong> <?php echo htmlspecialchars($email); ?></li>
    </ul>

    <div style="text-align:center;margin-top:2rem;">
      <a href="index.html">← Volver a GeoEscape</a>
    </div>
  </div>
  <script src="js/cookie-banner.js"></script>
</body>
</html>
