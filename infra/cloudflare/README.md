# Ruta pública de RBMT en Cloudflare

El sitio sigue desplegado en `https://rbmt.netlify.app`. El Worker [`rbmt-proxy.mjs`](rbmt-proxy.mjs) sirve ese origen bajo `https://project-robin.com/rbmt/`, incluido `/rbmt/admin/`, las imágenes y las Functions. Así el sitio y la API comparten origen en el navegador.

En la zona `project-robin.com` de Cloudflare:

1. Crea un Worker independiente llamado `project-robin-rbmt` con el contenido exacto de `rbmt-proxy.mjs` y publícalo.
2. Añade la ruta `project-robin.com/rbmt*` a ese Worker. El código solo intercepta `/rbmt` y `/rbmt/*`; las demás rutas continúan hacia el origen normal.
3. Configura `SITE_URL=https://project-robin.com/rbmt` en el sitio `rbmt` de Netlify y despliega de nuevo.

El Worker redirige `/rbmt` y `/rbmt/admin` a sus versiones con barra final para que los recursos relativos carguen desde el directorio correcto. Las redirecciones internas de Netlify también se mantienen bajo `/rbmt`.

Comprueba `https://project-robin.com/rbmt/`, `/rbmt/admin/`, `/rbmt/assets/img/logo-robin.png` y una llamada de API antes de compartir los enlaces. El origen de Netlify permanece disponible para diagnóstico.
