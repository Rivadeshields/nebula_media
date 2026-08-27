# Activar guardado (10 minutos)

## Paso 1 — Token de GitHub

1. Abre https://github.com/settings/personal-access-tokens/new
2. Nombre: `nebula-workshop`
3. Repositorio: **solo** `nebula_media`
4. Permiso: **Contents → Read and write**
5. **Generate token** → copia el `github_pat_…` (solo se ve una vez)

---

## Paso 2 — Cloudflare Worker (gratis)

1. Cuenta en https://dash.cloudflare.com/sign-up
2. Menú **Workers & Pages** → **Create** → **Create Worker**
3. Nombre: `nebula-workshop-save` → **Deploy**
4. **Edit code** → borra todo → pega el contenido de `worker/workshop-save.js` del repo
5. **Deploy**
6. **Settings** → **Variables** → **Add**:
   - Name: `GH_PAT` · Value: tu `github_pat_…` · **Encrypt**
7. **Save**

Copia la URL del worker (ej. `https://nebula-workshop-save.TU-SUBDOMINIO.workers.dev`).

Prueba en el navegador: debe decir `{"ok":true,"service":"nebula-workshop-save"}`

---

## Paso 3 — Conectar la web

Edita en GitHub: https://github.com/Rivadeshields/nebula_media/edit/main/config.js

```js
saveUrl: "https://nebula-workshop-save.TU-SUBDOMINIO.workers.dev",
```

Commit → espera 1 min → recarga la maqueta con **Cmd+Shift+R**.

---

## Paso 4 — Probar

1. Edita un texto
2. **Guardar**
3. Debe aparecer pantalla verde **Guardado**
4. Abre la web en otro dispositivo o ventana incógnito → mismo cambio

Listo para mandar al equipo: https://rivadeshields.github.io/nebula_media/
