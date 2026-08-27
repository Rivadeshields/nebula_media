# Guardar (estilo Jotform)

Edita → **Guardar** → listo. Sin login ni claves.

## Activar guardado (una vez, admin)

1. Token GitHub: https://github.com/settings/personal-access-tokens/new  
   Repo `nebula_media` · **Contents: Read and write**

2. Desplegar Worker:
```bash
cd worker
cp wrangler.toml.example wrangler.toml
npx wrangler login
npx wrangler secret put GH_PAT
npx wrangler deploy
```

3. Pegar la URL en `config.js`:
```js
saveUrl: "https://TU-WORKER.workers.dev",
```

Commit en GitHub. Recarga con **Cmd+Shift+R**.
