# Nébula Media — maqueta de contenidos

Página provisional para ordenar y editar el copy de la web antes de pasarlo a diseño.

## Uso local

```bash
python3 -m http.server 8765
```

Abre http://localhost:8765/

1. Haz clic en cualquier texto marcado (borde al pasar el mouse).
2. Edita en el lugar.
3. **Guardar** guarda el borrador en el navegador.
4. **Exportar MD** o **Exportar JSON** descarga el copy ordenado por sección para la diseñadora.

## GitHub Pages

1. Sube este repo a GitHub.
2. Settings → Pages → Source: `Deploy from a branch` → branch `main` → `/ (root)`.
3. La URL quedará en `https://<usuario>.github.io/<repo>/`.

## Entrega a diseñadora

El archivo `nebula-copy.md` (o `.json`) es el entregable de textos: títulos, bajadas, CTAs y cuerpos por sección.
