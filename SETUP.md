# Configurar el espacio compartido (solo quien administra)

Los demás usuarios **no** hacen esto. Solo abren la web, editan y pulsan **Guardar**.

## 1. Crear proyecto gratis en Supabase

1. Entra a https://supabase.com y crea un proyecto.
2. Ve a **Project Settings → API**.
3. Copia:
   - **Project URL**
   - **anon public** key

## 2. Crear la tabla

En Supabase → **SQL → New query**, pega y ejecuta:

```sql
create table if not exists nebula_content (
  id int primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  updated_by text
);

alter table nebula_content enable row level security;

create policy "public read" on nebula_content
  for select using (true);

create policy "public insert" on nebula_content
  for insert with check (true);

create policy "public update" on nebula_content
  for update using (true);

insert into nebula_content (id, payload)
values (1, '{}'::jsonb)
on conflict (id) do nothing;
```

## 3. Pegar datos en `config.js`

```js
window.NEBULA_CONFIG = {
  supabaseUrl: "https://XXXX.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...",
  teamPassword: "opcional-clave-del-equipo",
};
```

Si pones `teamPassword`, el equipo la escribe una vez al guardar.

## 4. Subir el cambio a GitHub Pages

```bash
git add config.js
git commit -m "Configure shared workshop space"
git push
```

Listo. Comparte solo el link de la web con el equipo.
