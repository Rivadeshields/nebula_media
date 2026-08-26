# Clave del equipo (solo quien administra)

Los demás **no** crean tokens. Solo escriben la **clave del equipo** en la barra de la web y pulsan Guardar.

## 1. Revoca el token anterior (importante)

Si ya generaste uno y lo pegaste en el chat, revócalo:
https://github.com/settings/personal-access-tokens

## 2. Crea un token nuevo

1. https://github.com/settings/personal-access-tokens/new  
2. Solo repo `nebula_media`  
3. Permission **Contents → Read and write**  
4. Generate y copia el token (`github_pat_…`)

## 3. Úsalo como “clave del equipo”

- En la web, campo **Clave del equipo**, pega el token.  
- Comparte esa misma clave con el equipo por WhatsApp/mail.  
- Cada persona la escribe una vez en su navegador (no va en GitHub).

No la subas a `config.js`: GitHub bloquea el push si el token está en el código.
