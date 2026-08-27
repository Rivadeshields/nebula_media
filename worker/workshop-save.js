/**
 * Proxy de guardado para Nébula Workshop.
 * El token de GitHub vive SOLO en secrets del Worker (no en config.js público).
 *
 * Secrets en Cloudflare:
 *   GH_PAT, GH_OWNER, GH_REPO, GH_BRANCH (opcional)
 *   SAVE_KEY (opcional, solo si quieres bloquear saves anónimos)
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function gh(env, path, opts = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GH_PAT}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(data?.message || `GitHub ${res.status}`);
  return data;
}

async function putFile(env, path, contentBase64, message) {
  const owner = env.GH_OWNER;
  const repo = env.GH_REPO;
  const branch = env.GH_BRANCH || "main";
  let sha;
  try {
    const existing = await gh(env, `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`);
    sha = existing.sha;
  } catch {
    sha = undefined;
  }
  await gh(env, `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "JSON inválido" }, 400);
    }

    if ((env.SAVE_KEY || "") && body.key !== env.SAVE_KEY) {
      return json({ ok: false, error: "No autorizado" }, 401);
    }

    const payload = body.payload;
    if (!payload) return json({ ok: false, error: "Falta payload" }, 400);

    try {
      const message = "Workshop: update content";
      const imagePaths = { ...(payload.images || {}) };

      for (const [key, b64] of Object.entries(body.images || {})) {
        if (!b64) continue;
        const safe = key.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
        const rel = `uploads/${safe}.jpg`;
        await putFile(env, rel, b64, message);
        imagePaths[key] = rel;
      }

      payload.images = imagePaths;
      await putFile(env, "content.json", utf8ToBase64(`${JSON.stringify(payload, null, 2)}\n`), message);
      return json({ ok: true });
    } catch (err) {
      return json({ ok: false, error: err.message || "Error al guardar" }, 500);
    }
  },
};
