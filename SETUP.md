# Para el equipo (Nico, Tamara, Joaquín)

1. Abrir https://rivadeshields.github.io/nebula_media/
2. Elegir **quién eres** en el menú
3. Clave: **1234**
4. Editar y pulsar **Guardar**

No hace falta GitHub ni tokens.

---

# Solo quien administra (Rivadeshields)

Para que **Guardar** publique para todos, falta pegar el token de GitHub **una vez** en `config.js` en github.com:

1. Crear token: https://github.com/settings/personal-access-tokens/new  
   - Repo `nebula_media` · **Contents: Read and write**
2. En github.com → repo → `config.js` → Edit  
3. Pegar el token en `githubToken: "github_pat_…"`  
4. Commit (si GitHub pide “allow secret”, aceptar)

La clave **1234** es solo para el equipo; el token es invisible para ellos.
