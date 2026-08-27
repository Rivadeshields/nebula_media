/**
 * Nébula Workshop — guardado compartido
 * Desplegar en Cloudflare Workers (gratis).
 * Solo secret necesario: GH_PAT
 */

const REPO = { owner: "Rivadeshields", repo: "nebula_media", branch: "main" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

async function gh(token, path, opts = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "nebula-workshop-save",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const detail = data?.message || data?.raw || res.statusText;
    throw new Error(`GitHub ${res.status}: ${detail}`);
  }
  return data;
}

async function putFile(token, path, contentBase64, message) {
  const { owner, repo, branch } = REPO;
  let sha;
  try {
    const existing = await gh(
      token,
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`
    );
    sha = existing.sha;
  } catch {
    sha = undefined;
  }
  await gh(token, `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
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
    if (request.method === "GET") {
      const url = new URL(request.url);
      if (url.searchParams.get("diag") === "1") {
        const token = env.GH_PAT;
        if (!token) return json({ ok: false, error: "GH_PAT no configurado" }, 500);
        try {
          const me = await gh(token, "/user");
          const repo = await gh(token, `/repos/${REPO.owner}/${REPO.repo}`);
          return json({
            ok: true,
            login: me.login || null,
            repo: repo.full_name,
            permissions: repo.permissions || null,
          });
        } catch (err) {
          return json({ ok: false, error: err.message || String(err) }, 500);
        }
      }
      return json({ ok: true, service: "nebula-workshop-save" });
    }

    if (request.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

    const token = env.GH_PAT;
    if (!token) return json({ ok: false, error: "GH_PAT no configurado" }, 500);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "JSON inválido" }, 400);
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
        await putFile(token, rel, b64, message);
        imagePaths[key] = rel;
      }

      payload.images = imagePaths;
      await putFile(token, "content.json", utf8ToBase64(`${JSON.stringify(payload, null, 2)}\n`), message);
      return json({ ok: true });
    } catch (err) {
      return json({ ok: false, error: err.message || "Error al guardar" }, 500);
    }
  },
};
