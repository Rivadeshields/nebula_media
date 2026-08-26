/**
 * Nébula — editor de copy provisional
 * Guarda en localStorage, exporta Markdown / JSON para la diseñadora.
 */
(() => {
  const STORAGE_KEY = "nebula-copy-v1";
  const statusEl = () => document.getElementById("editor-status");

  function fields() {
    return [...document.querySelectorAll("[data-field]")];
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

  function save() {
    const data = collect();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const t = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    setStatus(`Guardado · ${t}`);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setStatus("Sin cambios locales");
        return;
      }
      apply(JSON.parse(raw));
      setStatus("Borrador local restaurado");
    } catch {
      setStatus("No se pudo restaurar el borrador");
    }
  }

  function reset() {
    if (!confirm("¿Borrar el borrador local y volver a los textos del HTML?")) return;
    localStorage.removeItem(STORAGE_KEY);
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
      "> Documento de trabajo. Textos provisionales ordenados por sección.",
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

  function toJSON() {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        project: "Nébula Media — maqueta de contenidos",
        sections: grouped(),
        flat: collect(),
      },
      null,
      2
    );
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

  function exportMd() {
    save();
    download("nebula-copy.md", toMarkdown(), "text/markdown;charset=utf-8");
    setStatus("Exportado · Markdown");
  }

  function exportJson() {
    save();
    download("nebula-copy.json", toJSON(), "application/json;charset=utf-8");
    setStatus("Exportado · JSON");
  }

  function wire() {
    let timer;
    for (const el of fields()) {
      el.setAttribute("contenteditable", "true");
      el.setAttribute("spellcheck", "true");
      el.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(save, 400);
        setStatus("Editando…");
      });
      el.addEventListener("blur", save);
    }

    document.getElementById("btn-save")?.addEventListener("click", save);
    document.getElementById("btn-export-md")?.addEventListener("click", exportMd);
    document.getElementById("btn-export-json")?.addEventListener("click", exportJson);
    document.getElementById("btn-reset")?.addEventListener("click", reset);

    // Avoid navigating away when editing CTA-looking links that are copy fields
    document.querySelectorAll('a[data-field]').forEach((a) => {
      a.addEventListener("click", (e) => e.preventDefault());
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    wire();
    load();
  });
})();
