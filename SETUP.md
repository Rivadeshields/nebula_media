# Equipo (Nico, Tamara, Joaquín)

1. https://rivadeshields.github.io/nebula_media/
2. Nombre + clave **1234** + **Guardar**

---

# Admin — por qué fallaba el token

Si pegabas el token en `config.js` y GitHub lo aceptaba, **GitHub lo revoca solo** en repos públicos (secret scanning). Por eso fallaba aunque crearas uno nuevo.

**Solución:** el token va en **Cloudflare Worker** (privado), no en la web.

## Setup (una vez, ~10 min)

### 1. Token de GitHub
- https://github.com/settings/personal-access-tokens/new
- Repo: `nebula_media` · **Contents: Read and write**
- Copiar `github_pat_…` (no pegarlo en config.js)

### 2. Cloudflare Worker (gratis)
```bash
cd worker
cp wrangler.toml.example wrangler.toml
npm create cloudflare@latest . -- --type=hello-world   # si no tienes wrangler
npx wrangler secret put TEAM_PASSWORD    # escribe: 1234
npx wrangler secret put GH_PAT           # pega el github_pat
npx wrangler deploy
```

Copia la URL que devuelve (ej. `https://nebula-workshop-save.xxx.workers.dev`).

### 3. config.js en GitHub
Edita https://github.com/Rivadeshields/nebula_media/edit/main/config.js

```js
saveUrl: "https://TU-WORKER.workers.dev",
```

**Quita** `githubToken` si existe. Commit.

### 4. Probar
Recarga con **Cmd+Shift+R** → Nico → 1234 → Guardar.
