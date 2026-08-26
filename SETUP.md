# Para el equipo (Nico, Tamara, Joaquín)

1. https://rivadeshields.github.io/nebula_media/
2. Elegir nombre · clave **1234** · **Guardar**

---

# Solo admin — token nuevo (si falla el guardado)

El error **"Bad credentials"** = el token de GitHub ya no sirve. Crear uno nuevo:

1. https://github.com/settings/personal-access-tokens/new  
2. **Repository access:** Only `Rivadeshields/nebula_media`  
3. **Permissions → Repository permissions → Contents:** Read and write  
4. Generate token → copiar `github_pat_…`  
5. En github.com → repo → **config.js** → Edit → pegar en `githubToken: "…"`  
6. Commit → **Allow secret** si GitHub lo pide  
7. Esperar 1 min · recargar la web con **Cmd+Shift+R**

La clave **1234** no cambia; solo se renueva el token invisible.
