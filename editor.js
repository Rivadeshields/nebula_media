/**
 * Nébula — editor colaborativo
 * Carga content.json del repo; "Guardar en GitHub" publica textos e imágenes.
 */
(() => {
  const STORAGE_KEY = "nebula-copy-v1";
  const IMAGES_KEY = "nebula-images-v1";
  const TOKEN_KEY = "nebula-gh-token";
  const MAX_IMAGE_SIDE = 1400;
  const JPEG_QUALITY = 0.78;
  const DEFAULT_REPO = { owner: "Rivadeshields", repo: "nebula_media", branch: "main" };

  const statusEl = () => document.getElementById("editor-status");
  const githubStatusEl = () => document.getElementById("github-status");

  let activeImageSlot = null;
  let images = {};
  const defaults = {};
  let saving = false;

  function detectRepo() {
    const host = location.hostname.toLowerCase();
    if (host.endsWith(".github.io")) {
      const owner = host.split(".")[0];
      const parts = location.pathname.split("/").filter(Boolean);
      const repo = parts[0] || `${owner}.github.io`;
      return { owner, repo, branch: "main" };
    }
    return { ...DEFAULT_REPO };
  }

  const REPO = detectRepo();

  function fields() {
    return [...document.querySelectorAll("[data-field]")];
  }

  function imageSlots() {
    return [...document.querySelectorAll("[data-image]")];
  }

  function captureDefaults() {
    for (const el of fields()) {
      defaults[el.dataset.field] = el.innerText.trim();
    }
  }

  function fieldText(key) {
    const el = document.querySelector(`[data-field="${key}"]`);
    return el ? el.innerText.trim() : "";
  }

  function isPlaceholder(value) {
    if (!value) return true;
    if (/^\[.*\]$/.test(value)) return true;
    if (value.includes("[") && value.includes("]")) return true;
    return false;
  }

  function changed(key) {
    const now = fieldText(key);
    const original = defaults[key];
    if (!now) return false;
    if (isPlaceholder(now)) return false;
    return now !== original;
  }

  function isDataUrl(value) {
    return typeof value === "string" && value.startsWith("data:");
  }

  function hasImage(key) {
    return Boolean(images[key]);
  }

  function hasAnyImage(prefix) {
    return Object.keys(images).some((k) => k.startsWith(prefix));
  }

  function collect() {
    const data = {};
    for (const el of fields()) {
      data[el.dataset.field] = el.innerText.trim();
    }
    return data;
  }

  function apply(data) {
    if (!data) return;
    for (const el of fields()) {
      const key = el.dataset.field;
      if (Object.prototype.hasOwnProperty.call(data, key) && data[key] != null) {
        el.innerText = data[key];
      }
    }
  }

  function setStatus(msg) {
    const el = statusEl();
    if (el) el.textContent = msg;
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  function updateGithubStatus(extra) {
    const el = githubStatusEl();
    if (!el) return;
    const token = getToken();
    el.textContent = token
      ? `GitHub: conectado · ${REPO.owner}/${REPO.repo}${extra ? ` · ${extra}` : ""}`
      : `GitHub: no conectado${extra ? ` · ${extra}` : ""}`;
  }

  function paintImageSlot(slot, value) {
    const img = slot.querySelector(".upload-img");
    const clearBtn = slot.querySelector(".upload-clear");
    if (!img) return;
    if (value) {
      img.src = value;
      img.hidden = false;
      img.alt = slot.dataset.imageLabel || "Imagen";
      slot.classList.add("has-image");
      if (clearBtn) clearBtn.hidden = false;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
      img.alt = "";
      slot.classList.remove("has-image");
      if (clearBtn) clearBtn.hidden = true;
    }
  }

  function applyImages(map) {
    images = map && typeof map === "object" ? { ...map } : {};
    for (const slot of imageSlots()) {
      paintImageSlot(slot, images[slot.dataset.image] || null);
    }
  }

  function saveLocalDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collect()));
      localStorage.setItem(IMAGES_KEY, JSON.stringify(images));
      return true;
    } catch {
      setStatus("No se pudo guardar el borrador local (¿imágenes muy pesadas?)");
      return false;
    }
  }

  const pendingChecks = {
    promesa: () => changed("inicio.headline"),
    servicio2: () => {
      const note = fieldText("servicios.s2_nota");
      if (changed("servicios.s2_texto") && note && !/pendiente/i.test(note)) return true;
      if (changed("servicios.s2_nota") && !/pendiente/i.test(note)) return true;
      return false;
    },
    testimonio: () => changed("quienes.testimonio") && !isPlaceholder(fieldText("quienes.testimonio")),
    equipo: () => {
      const photos = ["quienes.p1", "quienes.p2", "quienes.p3"].filter(hasImage).length;
      const names =
        changed("quienes.p1_nombre") || changed("quienes.p2_nombre") || changed("quienes.p3_nombre");
      const roles =
        changed("quienes.p1_rol") || changed("quienes.p2_rol") || changed("quienes.p3_rol");
      return photos >= 1 && (names || roles || photos >= 3);
    },
    esquema: () => hasImage("como.esquema"),
    lab: () => changed("lab.e1_titulo") || changed("lab.e1_texto") || changed("lab.e1_meta"),
    portafolio: () => hasAnyImage("portafolio."),
  };

  function updatePendings() {
    const items = [...document.querySelectorAll("#pending-list [data-pending]")];
    let doneCount = 0;
    for (const li of items) {
      const id = li.dataset.pending;
      const check = pendingChecks[id];
      const done = check ? Boolean(check()) : false;
      li.classList.toggle("is-done", done);
      li.setAttribute("aria-checked", done ? "true" : "false");
      if (done) doneCount += 1;
    }
    const meta = document.getElementById("pending-meta");
    if (meta) {
      meta.textContent =
        doneCount === items.length
          ? "Todos los pendientes completados"
          : `${doneCount} de ${items.length} completados · se actualizan solos`;
    }
    const hint = document.getElementById("equipo-hint");
    if (hint) {
      const photos = ["quienes.p1", "quienes.p2", "quienes.p3"].filter(hasImage).length;
      hint.textContent =
        photos === 3
          ? "· fotos listas"
          : photos > 0
            ? `· ${photos}/3 fotos`
            : "· clic en cada foto para subir";
    }
  }

  async function loadSharedContent() {
    try {
      const res = await fetch(`content.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return false;
      const payload = await res.json();
      if (payload.fields && Object.keys(payload.fields).length) {
        apply(payload.fields);
      }
      if (payload.images && Object.keys(payload.images).length) {
        applyImages(payload.images);
      }
      if (payload.updatedAt) {
        const when = new Date(payload.updatedAt).toLocaleString("es-CL");
        setStatus(`Contenido del repo · ${when}${payload.updatedBy ? ` · ${payload.updatedBy}` : ""}`);
      }
      return true;
    } catch {
      return false;
    }
  }

  function loadLocalDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const rawImages = localStorage.getItem(IMAGES_KEY);
      if (!raw && !rawImages) return false;
      if (raw) apply(JSON.parse(raw));
      if (rawImages) applyImages(JSON.parse(rawImages));
      return true;
    } catch {
      return false;
    }
  }

  function resetLocal() {
    if (!confirm("¿Borrar solo el borrador local de este navegador? (no afecta GitHub)")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(IMAGES_KEY);
    location.reload();
  }

  function sectionTitle(id) {
    const map = {
      inicio: "01 · Inicio",
      "como-trabajamos": "02 · Cómo trabajamos",
      "quienes-somos": "03 · Quiénes somos",
      servicios: "04 · Servicios",
      portafolio: "05 · Portafolio",
      lab: "06 · Blog / Lab",
      footer: "07 · Footer / RED",
    };
    return map[id] || id;
  }

  function grouped() {
    const groups = {};
    for (const el of fields()) {
      const section = el.dataset.section || "general";
      const label = el.dataset.label || el.dataset.field;
      if (!groups[section]) groups[section] = [];
      groups[section].push({ label, value: el.innerText.trim(), field: el.dataset.field });
    }
    return groups;
  }

  function toMarkdown() {
    const groups = grouped();
    const lines = [
      "# Nébula Media — Copy para diseñadora",
      "",
      `_Exportado: ${new Date().toLocaleString("es-CL")}_`,
      "",
    ];
    for (const [section, items] of Object.entries(groups)) {
      lines.push(`## ${sectionTitle(section)}`, "");
      for (const item of items) {
        lines.push(`### ${item.label}`, "", item.value || "_(vacío)_", "");
      }
    }
    return lines.join("\n");
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Archivo de imagen inválido"));
        img.onload = () => {
          let { width, height } = img;
          const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function githubApi(path, options = {}) {
    const token = getToken();
    if (!token) throw new Error("Conecta GitHub antes de guardar");
    const res = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
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
      const msg = data?.message || `Error GitHub ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  function safeUploadName(key) {
    return key.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  }

  function dataUrlToBase64(dataUrl) {
    const parts = dataUrl.split(",");
    return parts[1] || "";
  }

  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function createBlob(content, encoding) {
    return githubApi(`/repos/${REPO.owner}/${REPO.repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content, encoding }),
    });
  }

  async function saveToGithub() {
    if (saving) return;
    if (!getToken()) {
      openGithubModal();
      setStatus("Conecta GitHub para publicar los cambios");
      return;
    }

    saving = true;
    const btn = document.getElementById("btn-save-github");
    if (btn) btn.disabled = true;
    setStatus("Publicando en GitHub…");

    try {
      const me = await githubApi("/user");
      const login = me.login || "equipo";

      const imagePaths = {};
      const treeItems = [];

      for (const [key, value] of Object.entries(images)) {
        if (!value) continue;
        if (isDataUrl(value)) {
          const path = `uploads/${safeUploadName(key)}.jpg`;
          const blob = await createBlob(dataUrlToBase64(value), "base64");
          treeItems.push({ path, mode: "100644", type: "blob", sha: blob.sha });
          imagePaths[key] = path;
        } else {
          imagePaths[key] = value;
        }
      }

      const payload = {
        updatedAt: new Date().toISOString(),
        updatedBy: login,
        fields: collect(),
        images: imagePaths,
      };
      const contentBlob = await createBlob(utf8ToBase64(JSON.stringify(payload, null, 2)), "base64");
      treeItems.push({
        path: "content.json",
        mode: "100644",
        type: "blob",
        sha: contentBlob.sha,
      });

      const ref = await githubApi(`/repos/${REPO.owner}/${REPO.repo}/git/ref/heads/${REPO.branch}`);
      const parentSha = ref.object.sha;
      const parentCommit = await githubApi(`/repos/${REPO.owner}/${REPO.repo}/git/commits/${parentSha}`);

      const tree = await githubApi(`/repos/${REPO.owner}/${REPO.repo}/git/trees`, {
        method: "POST",
        body: JSON.stringify({
          base_tree: parentCommit.tree.sha,
          tree: treeItems,
        }),
      });

      const commit = await githubApi(`/repos/${REPO.owner}/${REPO.repo}/git/commits`, {
        method: "POST",
        body: JSON.stringify({
          message: `Update workshop content (${login})`,
          tree: tree.sha,
          parents: [parentSha],
        }),
      });

      await githubApi(`/repos/${REPO.owner}/${REPO.repo}/git/refs/heads/${REPO.branch}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: commit.sha }),
      });

      applyImages(imagePaths);
      saveLocalDraft();
      updatePendings();
      updateGithubStatus("publicado");
      setStatus(`Guardado en GitHub · ${new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} · Pages puede tardar ~1 min`);
    } catch (err) {
      console.error(err);
      setStatus(`Error al guardar: ${err.message}`);
      if (/Bad credentials|401|403|Resource not accessible/i.test(err.message)) {
        updateGithubStatus("revisa el token");
        openGithubModal();
      }
    } finally {
      saving = false;
      if (btn) btn.disabled = false;
    }
  }

  async function handleImageFile(file) {
    if (!activeImageSlot || !file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Elige un archivo de imagen");
      return;
    }
    const key = activeImageSlot.dataset.image;
    setStatus("Procesando imagen…");
    try {
      const dataUrl = await compressImage(file);
      images[key] = dataUrl;
      paintImageSlot(activeImageSlot, dataUrl);
      saveLocalDraft();
      updatePendings();
      setStatus("Imagen lista · pulsa “Guardar en GitHub” para publicarla");
    } catch (err) {
      setStatus(err.message || "No se pudo subir la imagen");
    } finally {
      activeImageSlot = null;
    }
  }

  function clearImage(slot, event) {
    event?.stopPropagation();
    const key = slot.dataset.image;
    delete images[key];
    paintImageSlot(slot, null);
    saveLocalDraft();
    updatePendings();
    setStatus("Imagen quitada · guarda en GitHub para publicar el cambio");
  }

  function openPicker(slot) {
    activeImageSlot = slot;
    const picker = document.getElementById("image-picker");
    if (!picker) return;
    picker.value = "";
    picker.click();
  }

  function openGithubModal() {
    const modal = document.getElementById("github-modal");
    const input = document.getElementById("github-token");
    const disconnect = document.getElementById("btn-github-disconnect");
    if (!modal) return;
    modal.hidden = false;
    if (input) input.value = getToken();
    if (disconnect) disconnect.hidden = !getToken();
  }

  function closeGithubModal() {
    const modal = document.getElementById("github-modal");
    if (modal) modal.hidden = true;
  }

  function wireImages() {
    const picker = document.getElementById("image-picker");
    picker?.addEventListener("change", () => {
      const file = picker.files && picker.files[0];
      handleImageFile(file);
    });

    for (const slot of imageSlots()) {
      slot.setAttribute("role", "button");
      slot.setAttribute("tabindex", "0");
      slot.setAttribute(
        "aria-label",
        `Subir imagen: ${slot.dataset.imageLabel || slot.dataset.image}`
      );

      slot.addEventListener("click", (e) => {
        if (e.target.closest(".upload-clear")) return;
        openPicker(slot);
      });
      slot.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker(slot);
        }
      });

      slot.querySelector(".upload-clear")?.addEventListener("click", (e) => clearImage(slot, e));
    }
  }

  function wireGithubModal() {
    document.getElementById("btn-connect-github")?.addEventListener("click", openGithubModal);
    document.getElementById("btn-github-cancel")?.addEventListener("click", closeGithubModal);
    document.getElementById("btn-github-disconnect")?.addEventListener("click", () => {
      clearToken();
      updateGithubStatus();
      closeGithubModal();
      setStatus("GitHub desconectado en este navegador");
    });
    document.getElementById("btn-github-save-token")?.addEventListener("click", async () => {
      const input = document.getElementById("github-token");
      const token = (input?.value || "").trim();
      if (!token) {
        setStatus("Pega un token válido");
        return;
      }
      setToken(token);
      try {
        const me = await githubApi("/user");
        updateGithubStatus(me.login);
        closeGithubModal();
        setStatus(`Conectado como ${me.login}`);
      } catch (err) {
        clearToken();
        updateGithubStatus();
        setStatus(`Token inválido: ${err.message}`);
      }
    });
    document.getElementById("github-modal")?.addEventListener("click", (e) => {
      if (e.target.id === "github-modal") closeGithubModal();
    });
  }

  function wire() {
    let timer;
    for (const el of fields()) {
      el.setAttribute("contenteditable", "true");
      el.setAttribute("spellcheck", "true");
      el.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          saveLocalDraft();
          updatePendings();
        }, 400);
        setStatus("Editando… (borrador local) · Guardar en GitHub para publicar");
        updatePendings();
      });
      el.addEventListener("blur", () => {
        saveLocalDraft();
        updatePendings();
      });
    }

    document.getElementById("btn-save-github")?.addEventListener("click", saveToGithub);
    document.getElementById("btn-export-md")?.addEventListener("click", () => {
      saveLocalDraft();
      download("nebula-copy.md", toMarkdown(), "text/markdown;charset=utf-8");
      setStatus("Exportado · Markdown");
    });
    document.getElementById("btn-export-json")?.addEventListener("click", () => {
      saveLocalDraft();
      download(
        "nebula-copy.json",
        JSON.stringify({ fields: collect(), images: Object.keys(images) }, null, 2),
        "application/json;charset=utf-8"
      );
      setStatus("Exportado · JSON");
    });
    document.getElementById("btn-reset")?.addEventListener("click", resetLocal);

    document.querySelectorAll("a[data-field]").forEach((a) => {
      a.addEventListener("click", (e) => e.preventDefault());
    });

    wireImages();
    wireGithubModal();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    captureDefaults();
    wire();
    updateGithubStatus();

    const shared = await loadSharedContent();
    if (!shared) {
      loadLocalDraft();
      setStatus("Sin content.json remoto · usando HTML / borrador local");
    } else {
      // Local draft can override only if newer edits exist — keep shared as source of truth for collaboration
      saveLocalDraft();
    }
    updatePendings();
  });
})();
