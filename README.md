# Nébula Media — maqueta de contenidos

Página provisional para ordenar y editar el copy de la web **en equipo**, antes de pasarlo a diseño.

**Sitio:** https://rivadeshields.github.io/nebula_media/

## Cómo colaborar

1. Abre la página publicada (o `python3 -m http.server 8765` en local).
2. Edita textos (clic en el texto) o sube fotos (clic en el recuadro).
3. **Conectar GitHub** (una vez por persona/navegador):
   - [Fine-grained token](https://github.com/settings/tokens?type=beta)
   - Solo el repo `nebula_media`
   - Permiso **Contents: Read and write**
4. Pulsa **Guardar en GitHub**.
5. En ~1 minuto GitHub Pages se actualiza; el resto del equipo recarga la página y ve los cambios.

Los cambios viven en `content.json` y las imágenes en `uploads/`.

## Notas

- Hasta que alguien pulse **Guardar en GitHub**, los cambios son solo un borrador en ese navegador.
- **Reset local** borra el borrador del navegador; no toca el repo.
- **Exportar MD/JSON** descarga copy para la diseñadora.
