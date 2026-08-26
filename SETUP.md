# Configurar guardado en equipo (solo quien administra · 3 minutos)

Los demás **no** hacen esto. Solo abren el link, editan y pulsan **Guardar**.

## 1. Crear un token de GitHub

1. Abre: https://github.com/settings/personal-access-tokens/new  
2. Token name: `nebula-workshop`  
3. Expiration: 90 days (o lo que prefieras)  
4. Repository access: **Only select repositories** → `nebula_media`  
5. Permissions → **Contents: Read and write**  
6. Generate y **copia** el token (empieza con `github_pat_`)

## 2. Pegarlo en `config.js`

```js
window.NEBULA_CONFIG = {
  githubToken: "github_pat_…",  // tu token
  teamPassword: "",             // opcional
  owner: "Rivadeshields",
  repo: "nebula_media",
  branch: "main",
};
```

## 3. Avisarme o subir tú el cambio

Si me pegas el token aquí lo dejo yo en `config.js` y lo subo.  
O en la terminal:

```bash
git add config.js && git commit -m "Enable team save" && git push
```

## Seguridad

- El token queda en el JS de la web: úsalo **solo** para este workshop y limítalo al repo `nebula_media`.
- Si quieres más control, pon una `teamPassword`.
- Cuando termine el workshop, revoca el token en GitHub → Settings → Tokens.
