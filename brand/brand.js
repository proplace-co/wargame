/* Brand hub — client only. Reads brand/<id>/brand.json. */
(function () {
  const IDS = ["proplace", "maximum", "profund", "sosuites"];
  const SECTIONS = [
    ["logos", "Logos"],
    ["colors", "Couleurs"],
    ["type", "Caractères"],
    ["tokens", "Tokens"],
    ["voice", "Message"],
    ["marks", "Signes"],
    ["studio", "Générer"]
  ];
  const FORMATS = [
    { id: "li-land", name: "LinkedIn 1200×627", w: 1200, h: 627 },
    { id: "li-sq", name: "LinkedIn 1080×1080", w: 1080, h: 1080 },
    { id: "ig", name: "Instagram post 1080×1080", w: 1080, h: 1080 },
    { id: "story", name: "Instagram story 1080×1920", w: 1080, h: 1920 },
    { id: "x", name: "X 1600×900", w: 1600, h: 900 },
    { id: "mrec", name: "Display 300×250", w: 300, h: 250 },
    { id: "leader", name: "Display 728×90", w: 728, h: 90 }
  ];
  const PIP = { proplace: "#12A150", maximum: "#EC3013", profund: "#627C99", sosuites: "#1A1613" };

  const params = new URLSearchParams(location.search);
  const state = {
    id: IDS.includes(params.get("brand")) ? params.get("brand") : "proplace",
    section: (location.hash || "#logos").slice(1),
    lang: "fr",
    tool: "ads",
    format: "li-land",
    ground: "ink",
    brands: {},
    fields: null
  };
  if (!SECTIONS.some(([id]) => id === state.section)) state.section = "logos";

  const hub = document.getElementById("hub");
  const printStage = document.getElementById("print-stage");

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function t(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return value[state.lang] || value.fr || value.en || "";
  }
  function list(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return value[state.lang] || value.fr || value.en || [];
  }
  function asset(b, file) {
    return file ? `${b.id}/${file}` : "";
  }
  function primary(b) { return PIP[b.id]; }
function inkOf(b) {
  const colors = b.colors || [];
  const c = colors.find((x) => x.palette === "product" && (x.token === "--mx-noir" || x.token === "--ink" || x.token === "--pp-ink"))
    || colors.find((x) => x.name === "Encre" || x.name === "Noir");
  return c ? c.hex : "#161514";
}
function paperOf(b) {
  const colors = b.colors || [];
  const c = colors.find((x) => x.palette === "product" && (x.token === "--mx-fond" || x.token === "--bg" || x.token === "--pp-bg-page" || x.token === "--paper"))
    || colors.find((x) => x.token === "--bg" || x.token === "--paper");
  return c ? c.hex : "#f7f4f2";
}
  function fontOf(b) {
    return (b.typography && b.typography.specimen) || "DM Sans";
  }
  function cssFont(b) {
    return (b.typography && b.typography.css) || `"${fontOf(b)}", sans-serif`;
  }
  function wordmark(b) {
    return (b.logos || []).find((l) => l.id === "wordmark") || (b.logos || [])[0];
  }
  function fav(b) {
    return (b.logos || []).find((l) => /favicon|monogram|icon-180/.test(l.id)) || wordmark(b);
  }

  function hexToRgb(hex) {
    let h = String(hex).replace("#", "").trim();
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbStr(hex) {
    const { r, g, b } = hexToRgb(hex);
    return `rgb(${r}, ${g}, ${b})`;
  }
  function hslStr(hex) {
    let { r, g, b } = hexToRgb(hex);
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
  }
  function lum(hex) {
    const { r, g, b } = hexToRgb(hex);
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function contrast(a, b) {
    const L1 = lum(a), L2 = lum(b);
    const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
    return (hi + 0.05) / (lo + 0.05);
  }
  function aa(ratio, large) {
    return ratio >= (large ? 3 : 4.5);
  }
  function bestText(bg) {
    return contrast(bg, "#111111") >= contrast(bg, "#ffffff") ? "#111111" : "#ffffff";
  }
  function pill(b) {
    return b.id !== "maximum" && (b.radii || []).some((r) => String(r.value).includes("999"));
  }

  function fieldsFrom(b) {
    const s = b.studio || {};
    return {
      title: t(s.title),
      subtitle: t(s.subtitle),
      points: list(s.points).join("\n"),
      proof: t(s.proof),
      cta: t(s.cta),
      name: (s.signature && s.signature.name) || "",
      role: (s.signature && s.signature.role) || "",
      email: (s.signature && s.signature.email) || "",
      phone: (s.signature && s.signature.phone) || "",
      site: (s.signature && s.signature.site) || b.site.replace(/^https?:\/\/(www\.)?/, "")
    };
  }
  function ensureFields(b) {
    if (!state.fields || state.fields._id !== b.id || state.fields._lang !== state.lang) {
      state.fields = Object.assign({ _id: b.id, _lang: state.lang }, fieldsFrom(b));
    }
  }
  function points() {
    return String(state.fields.points || "").split(/\n/).map((x) => x.trim()).filter(Boolean).slice(0, 4);
  }

  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); } catch (e) { return; }
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = "Copié";
    setTimeout(() => { btn.textContent = prev; }, 1200);
  }

  function render() {
    const b = state.brands[state.id];
    ensureFields(b);
    const accent = primary(b);
    hub.innerHTML = `
      <header class="top">
        <a class="brand-lock" href="/brand/">
          <b>Brand hub</b>
          <span>4 activités</span>
        </a>
        <nav class="switch" aria-label="Marques">${IDS.map((id) => {
          const item = state.brands[id];
          return `<button type="button" data-brand="${id}" class="${id === state.id ? "on" : ""}" aria-pressed="${id === state.id}">
            <i class="pip" style="background:${PIP[id]}"></i>${esc(item.name)}
          </button>`;
        }).join("")}</nav>
        <div class="lang" role="group" aria-label="Langue">
          ${["fr", "en"].map((l) => `<button type="button" data-lang="${l}" class="${state.lang === l ? "on" : ""}">${l.toUpperCase()}</button>`).join("")}
        </div>
      </header>
      <main class="wrap">
        <header class="hero">
          <p class="kicker">Identité · source de vérité</p>
          <h1 style="font-family:${esc(cssFont(b))}">${esc(b.name)}</h1>
          <p class="lede" style="font-family:${esc(cssFont(b))}">${esc(t(b.tagline))}</p>
          <div class="meta">
            <a class="chip" href="${esc(b.site)}" target="_blank" rel="noreferrer">${esc(b.site.replace(/^https?:\/\//, ""))}</a>
            ${sourceChips(b)}
          </div>
        </header>
        <nav class="subnav" aria-label="Sections">${SECTIONS.map(([id, label]) =>
          `<button type="button" data-section="${id}" class="${state.section === id ? "on" : ""}">${label}</button>`
        ).join("")}</nav>
        <div class="section" id="panel">${panel(b)}</div>
      </main>`;
    bind();
    if (state.section === "studio") afterStudio(b);
    else printStage.hidden = true;
  }

  function sourceChips(b) {
    const s = b.source || {};
    const bits = [];
    if (s.access === "unavailable") {
      bits.push(`<span class="chip warn">Repo inaccessible · site public</span>`);
    } else if (s.commit) {
      bits.push(`<a class="chip" href="${esc(s.url)}/commit/${esc(s.commit)}" target="_blank" rel="noreferrer">${esc(s.repo)}@${esc(String(s.commit).slice(0, 7))}</a>`);
    }
    if (s.branch) bits.push(`<span class="chip">${esc(s.branch)}</span>`);
    return bits.join("");
  }

  function panel(b) {
    if (state.section === "logos") return logos(b);
    if (state.section === "colors") return colors(b);
    if (state.section === "type") return typePanel(b);
    if (state.section === "tokens") return tokens(b);
    if (state.section === "voice") return voice(b);
    if (state.section === "marks") return marks(b);
    return studio(b);
  }

  function logos(b) {
    const cards = (b.logos || []).map((logo) => {
      const src = asset(b, logo.file);
      const night = /on-dark|night/.test(logo.id) || String(logo.background).toLowerCase() === "#000000";
      return `<article class="card">
        <div class="stage ${night ? "dark" : "light"} clear"><img src="${esc(src)}" alt="${esc(logo.label)}"></div>
        <h3 style="margin:10px 0 4px;font-size:15px">${esc(logo.label)}</h3>
        <p class="note" style="padding:0;border:0;background:transparent">${esc(logo.usage || "")}</p>
        <p class="kicker" style="margin-top:8px">${esc(logo.format)} · ${esc(logo.background || "")}</p>
        <div class="row-actions">
          <a class="btn" href="${esc(src)}" download>Télécharger</a>
          <button type="button" class="btn-ghost" data-copy="${esc(src)}">Copier le chemin</button>
        </div>
      </article>`;
    }).join("");
    const dark = b.logoOnDarkFile
      ? `<div class="stage dark"><img src="${esc(asset(b, b.logoOnDarkFile))}" alt=""></div>`
      : b.logoOnDark === "invert"
      ? `<div class="stage dark"><img src="${esc(asset(b, wordmark(b).file))}" alt="" style="filter:brightness(0) invert(1)"></div>`
      : `<div class="stage dark"><span style="background:#fff;border-radius:10px;padding:12px 16px;display:inline-flex"><img src="${esc(asset(b, wordmark(b).file))}" alt=""></span></div>`;
    const bads = [
      ["Étiré", "transform:scaleX(1.45)"],
      ["Penché", "transform:rotate(-12deg)"],
      ["Recoloré", "filter:hue-rotate(80deg) saturate(2)"],
      ["Fond chargé", ""]
    ];
    return `
      <h2>Logos</h2>
      <p class="note">${esc(b.clearSpace || "")}</p>
      <div class="grid-logos">${cards}</div>
      <h2>Fond sombre</h2>
      <p class="note">${b.logoOnDarkFile
        ? "Version blanche dédiée : le signe rouge ne passe pas à l’invert."
        : b.logoOnDark === "invert"
        ? "Le site passe le wordmark en blanc avec brightness(0) invert(1). Le sourire s’éclaircit avec le mot."
        : "Ne pas inverser ce logo. Le poser sur une pastille claire, ou utiliser la marque carrée quand elle existe."}</p>
      <div class="grid-logos"><article class="card">${dark}</article></div>
      <h2>À éviter</h2>
      <div class="misuse">${bads.map(([label, style], i) => `
        <div class="bad">
          <div class="frame ${i === 3 ? "busy" : ""}"><img src="${esc(asset(b, wordmark(b).file))}" alt="" style="${style}"></div>
          <p>${esc(label)}</p>
        </div>`).join("")}</div>
      <ul class="note">${(b.misuse || []).map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`;
  }

  function colors(b) {
    const groups = {};
    (b.palettes || []).forEach((p) => { groups[p.id] = { palette: p, colors: [] }; });
    (b.colors || []).forEach((c) => {
      const id = c.palette || "product";
      if (!groups[id]) groups[id] = { palette: { id, name: id, status: "" }, colors: [] };
      groups[id].colors.push(c);
    });
    const blocks = Object.values(groups).map((g) => `
      <p class="palette-label">${esc(g.palette.name)} ${g.palette.status === "divergent" ? "· divergent" : ""}</p>
      ${g.palette.note ? `<p class="note">${esc(g.palette.note)}</p>` : ""}
      <div class="grid-colors">${g.colors.map((c) => {
        const onW = contrast(c.hex, "#ffffff");
        const onK = contrast(c.hex, "#111111");
        return `<button type="button" class="swatch" data-copy="${esc(c.hex)}">
          <div class="chip-color" style="background:${esc(c.hex)}"></div>
          <b>${esc(c.name)}</b>
          <code>${esc(c.hex)}</code>
          <small>${esc(c.role || "")}${c.token ? " · " + esc(c.token) : ""}</small>
          <small>${esc(rgbStr(c.hex))} · ${esc(hslStr(c.hex))}</small>
          <span class="badges">
            <span class="badge ${aa(onW, false) ? "" : "no"}">blanc ${onW.toFixed(1)}:1</span>
            <span class="badge ${aa(onK, false) ? "" : "no"}">encre ${onK.toFixed(1)}:1</span>
          </span>
        </button>`;
      }).join("")}</div>`).join("");
    return `<h2>Couleurs</h2>
      <p class="note">Un clic copie le hex. Le ratio est celui du hex contre le blanc et contre l’encre. Le badge passe au vert à partir de 4,5:1, le seuil du texte courant. Un aplat large peut se contenter de 3:1.</p>
      ${blocks}
      ${(b.gaps || []).length ? `<div class="gap"><b>Écarts relevés dans le code</b><ul>${b.gaps.map((g) => `<li>${esc(g)}</li>`).join("")}</ul></div>` : ""}`;
  }

  function typePanel(b) {
    const ty = b.typography || {};
    const family = fontOf(b);
    return `<h2>Caractères</h2>
      <p class="note">${esc(ty.note || "")}</p>
      <div class="specimen" style="font-family:${esc(cssFont(b))}">
        <p class="alpha">${esc(family)}</p>
        <p style="font-size:22px;margin:0 0 12px">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz 0123456789</p>
        <p style="margin:0;color:#5e584f">Graisses dans le produit : ${esc((ty.weights || []).join(" · "))}</p>
        ${(ty.scale || []).map((row) => `
          <div class="scale-row">
            <span>${esc(row.name)} · ${esc(row.size)} / ${esc(row.weight)}</span>
            <div style="font-family:${esc(row.family || cssFont(b))};font-weight:${Number(row.weight) || 500};font-size:${Number(row.size) || 16}px;letter-spacing:${esc(row.tracking || "0")};line-height:1.25">${esc(row.sample)}</div>
          </div>`).join("")}
      </div>
      <div class="split">${(ty.surfaces || []).map((s) => `
        <article class="card">
          <h3 style="margin:0 0 6px">${esc(s.name)}</h3>
          <p style="margin:0;font-family:${esc(s.family)}, sans-serif;font-size:28px;letter-spacing:-0.03em">${esc(s.family)}</p>
          <p class="note" style="border:0;padding:8px 0 0;background:transparent">${esc(s.detail || "")} ${s.mono ? "Mono : " + esc(s.mono) : ""}</p>
        </article>`).join("")}</div>
      <h2>Rayons, ombres, espaces</h2>
      <div class="token-grid">
        ${metric("Rayons", b.radii, accentBox)}
        ${metric("Ombres", b.shadows, (item) => `<div style="height:48px;border-radius:12px;background:#fff;box-shadow:${esc(item.value)}"></div>`)}
        ${metric("Espaces", b.spacing, (item) => `<div style="height:10px;width:min(100%, ${esc(String(item.value).split(",")[0])});background:${primary(b)};border-radius:99px"></div>`)}
      </div>`;
  }
  function accentBox(item) {
    const v = String(item.value);
    const radius = v.includes("clamp") ? "16px" : v;
    return `<div style="height:48px;border-radius:${esc(radius)};background:#f3f1eb;box-shadow:inset 0 0 0 2px #1c1915"></div>`;
  }
  function metric(title, items, preview) {
    if (!items || !items.length) return `<article class="card"><h3>${esc(title)}</h3><p class="note" style="border:0;padding:0;background:transparent">Aucun jeton nommé dans la source.</p></article>`;
    return `<article class="card"><h3 style="margin:0 0 8px">${esc(title)}</h3>${items.map((item) => `
      <div style="display:grid;gap:6px;margin-bottom:10px">
        ${preview(item)}
        <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px">
          <b>${esc(item.name)}</b><code style="font-family:var(--mono)">${esc(item.token || "")}</code>
        </div>
        <code style="font-family:var(--mono);font-size:11px;color:#5e584f">${esc(item.value)}</code>
      </div>`).join("")}</article>`;
  }

  function cssVars(b) {
    return (b.colors || []).filter((c) => c.token && c.palette === "product" && c.hex)
      .map((c) => `  ${c.token}: ${c.hex};`).join("\n");
  }
  function tokens(b) {
    const css = `:root {\n${cssVars(b)}\n  --font-sans: ${cssFont(b)};\n${(b.radii || []).filter((r) => r.token && r.token.startsWith("--")).map((r) => `  ${r.token}: ${r.value};`).join("\n")}\n}`;
    const json = JSON.stringify({
      name: b.name,
      color: Object.fromEntries((b.colors || []).filter((c) => c.token && c.palette === "product").map((c) => [c.token, c.hex])),
      radius: Object.fromEntries((b.radii || []).map((r) => [r.token || r.name, r.value])),
      shadow: Object.fromEntries((b.shadows || []).map((r) => [r.token || r.name, r.value])),
      font: cssFont(b)
    }, null, 2);
    const colors = {};
    (b.colors || []).filter((c) => c.palette === "product").forEach((c) => {
      const key = (c.token || c.name).replace(/^--/, "").replace(/[^a-z0-9]+/gi, "-");
      colors[key] = c.hex;
    });
    const tw = `/** Extrait des jetons ${b.name}. À coller dans theme.extend */\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: ${JSON.stringify(colors, null, 2).replace(/\n/g, "\n      ")},\n      fontFamily: { sans: [${JSON.stringify(cssFont(b))}] },\n      borderRadius: ${JSON.stringify(Object.fromEntries((b.radii || []).slice(0, 4).map((r) => [r.name.toLowerCase(), r.value])), null, 2)}\n    }\n  }\n};\n`;
    const extracted = b.sync && b.sync.cssVariables
      ? Object.entries(b.sync.cssVariables).map(([k, v]) => `  ${k}: ${v};`).join("\n")
      : "";
    return `<h2>Tokens</h2>
      <p class="note">Export des jetons produit seulement. Les palettes marquées divergentes restent dans l’onglet Couleurs, elles ne partent pas dans le fichier Tailwind.</p>
      <div class="token-grid">
        ${tokenCard("CSS variables", css)}
        ${tokenCard("JSON", json)}
        ${tokenCard("Tailwind", tw)}
        ${extracted ? tokenCard("Variables relues à la dernière synchro", `:root {\n${extracted}\n}`) : ""}
      </div>`;
  }
  function tokenCard(title, body) {
    return `<article class="card">
      <div class="token-head"><h3>${esc(title)}</h3><button type="button" class="btn-ghost" data-copy-block>Copier</button></div>
      <pre>${esc(body)}</pre>
    </article>`;
  }

  function voice(b) {
    const m = b.messaging || {};
    const v = b.voice || {};
    const block = (title, items) => `<article class="card voice"><h3 style="margin:0 0 8px">${esc(title)}</h3><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></article>`;
    const phrases = [t(b.tagline), t(b.promise), ...list(m.ctas)];
    return `<h2>Positionnement</h2>
      <div class="split">
        ${block("Positionnement", list(m.positioning))}
        ${block("À qui on parle", list(m.audiences))}
        ${block("Promesse chiffrée", list(m.value))}
        ${block("Preuves", list(m.proof))}
      </div>
      <h2>Offres</h2>
      <div class="grid-logos">${(m.offers || []).map((o) => `
        <article class="card" style="border-top:4px solid ${primary(b)}">
          <h3 style="margin:0">${esc(o.name)}</h3>
          <p style="font-weight:700;margin:6px 0">${esc(o.price)}</p>
          <p style="margin:0;color:#5e584f">${esc(t(o.pitch))}</p>
        </article>`).join("")}</div>
      <h2>Voix</h2>
      <p class="note">${esc(t(v.tone))}</p>
      <div class="split">
        ${block("Mots qui sonnent juste", v.use || [])}
        ${block("Mots à laisser", v.avoid || [])}
      </div>
      ${block("Règles tirées du code", v.rules || [])}
      <h2>Formules à recopier</h2>
      <div class="fields">${phrases.filter(Boolean).map((p) => `
        <button type="button" class="phrase" data-copy="${esc(p)}"><span>${esc(p)}</span><span class="kicker">Copier</span></button>`).join("")}</div>`;
  }

  function marks(b) {
    const icons = (b.logos || []).filter((l) => /favicon|icon|monogram|mark/.test(l.id));
    return `<h2>Favicons et signes</h2>
      <p class="note">${esc(b.iconStyle || "")}</p>
      <div class="grid-icons">${icons.map((logo) => `
        <article class="card">
          <div class="stage light"><img src="${esc(asset(b, logo.file))}" alt="${esc(logo.label)}" style="height:48px"></div>
          <p style="margin:8px 0 0;font-weight:650">${esc(logo.label)}</p>
          <a class="btn" style="margin-top:8px" href="${esc(asset(b, logo.file))}" download>Télécharger</a>
        </article>`).join("")}</div>
      <h2>Images</h2>
      <p class="note">${esc(b.imageStyle || "")}</p>
      <div class="grid-logos">${(b.images || []).map((img) => `
        <article class="card"><p class="kicker">${esc(img.label)}</p><img src="${esc(asset(b, img.file))}" alt="${esc(img.label)}" style="border-radius:12px"></article>`).join("")}</div>
      ${b.id === "sosuites" ? `<article class="card"><img src="sosuites/og-home.png" alt="Image d’accueil SoSuites" style="border-radius:12px"></article>` : ""}
      ${b.id === "maximum" ? `<article class="card"><p class="kicker">Carte publiée</p><img src="maximum/carte-visite-charles.png" alt="Carte de visite Charles Busson" style="border-radius:12px"></article>` : ""}`;
  }

  function studio(b) {
    const f = state.fields;
    return `<h2>Générer</h2>
      <p class="note">Tout se dessine dans le navigateur. Le PDF passe par l’impression du système. Les publicités et la carte sortent en PNG aux dimensions demandées. Les textes partent de la copie extraite, et restent éditables.</p>
      <div class="studio-tools" role="tablist">
        ${[["ads", "Publicités"], ["doc", "Fiche"], ["deck", "Présentation"], ["sign", "Signature"], ["card", "Carte"]].map(([id, label]) =>
          `<button type="button" data-tool="${id}" class="${state.tool === id ? "btn" : "btn-ghost"}">${label}</button>`).join("")}
      </div>
      <div class="studio-layout">
        <form class="fields" id="studio-form">
          <label>Titre<input id="f-title" value="${esc(f.title)}"></label>
          <label>Sous-titre<input id="f-subtitle" value="${esc(f.subtitle)}"></label>
          <label>Points, une ligne chacun<textarea id="f-points">${esc(f.points)}</textarea></label>
          <label>Preuve<input id="f-proof" value="${esc(f.proof)}"></label>
          <label>Bouton<input id="f-cta" value="${esc(f.cta)}"></label>
          <label>Nom<input id="f-name" value="${esc(f.name)}"></label>
          <label>Rôle<input id="f-role" value="${esc(f.role)}"></label>
          <label>E-mail<input id="f-email" value="${esc(f.email)}"></label>
          <label>Téléphone<input id="f-phone" value="${esc(f.phone)}"></label>
          <label>Site<input id="f-site" value="${esc(f.site)}"></label>
          ${state.tool === "ads" ? `
            <label>Format<select id="f-format">${FORMATS.map((fmt) => `<option value="${fmt.id}" ${fmt.id === state.format ? "selected" : ""}>${esc(fmt.name)}</option>`).join("")}</select></label>
            <label>Fond<select id="f-ground">
              <option value="ink" ${state.ground === "ink" ? "selected" : ""}>Encre</option>
              <option value="paper" ${state.ground === "paper" ? "selected" : ""}>Papier</option>
              <option value="accent" ${state.ground === "accent" ? "selected" : ""}>Accent</option>
            </select></label>` : ""}
          <div class="row-actions" id="studio-actions"></div>
        </form>
        <div id="studio-preview"></div>
      </div>`;
  }

  function bind() {
    hub.querySelectorAll("[data-brand]").forEach((btn) => btn.addEventListener("click", () => {
      state.id = btn.dataset.brand;
      state.fields = null;
      const url = new URL(location.href);
      url.searchParams.set("brand", state.id);
      history.replaceState(null, "", url);
      render();
    }));
    hub.querySelectorAll("[data-lang]").forEach((btn) => btn.addEventListener("click", () => {
      state.lang = btn.dataset.lang;
      state.fields = null;
      render();
    }));
    hub.querySelectorAll("[data-section]").forEach((btn) => btn.addEventListener("click", () => {
      state.section = btn.dataset.section;
      history.replaceState(null, "", `#${state.section}`);
      render();
    }));
    hub.querySelectorAll("[data-tool]").forEach((btn) => btn.addEventListener("click", () => {
      readForm();
      state.tool = btn.dataset.tool;
      render();
    }));
    hub.querySelectorAll("[data-copy]").forEach((btn) => btn.addEventListener("click", () => copy(btn.dataset.copy, btn)));
    hub.querySelectorAll("[data-copy-block]").forEach((btn) => btn.addEventListener("click", () => {
      const pre = btn.closest("article").querySelector("pre");
      copy(pre.textContent, btn);
    }));
    const form = hub.querySelector("#studio-form");
    if (form) {
      form.addEventListener("input", () => {
        readForm();
        paintStudio(state.brands[state.id]);
      });
      form.addEventListener("submit", (e) => e.preventDefault());
    }
  }
  function readForm() {
    const q = (id) => { const n = document.getElementById(id); return n ? n.value : null; };
    const f = state.fields;
    ["title", "subtitle", "points", "proof", "cta", "name", "role", "email", "phone", "site"].forEach((key) => {
      const v = q("f-" + key);
      if (v != null) f[key] = v;
    });
    if (q("f-format")) state.format = q("f-format");
    if (q("f-ground")) state.ground = q("f-ground");
  }

  function afterStudio(b) {
    paintStudio(b);
  }
  function paintStudio(b) {
    const slot = document.getElementById("studio-preview");
    const actions = document.getElementById("studio-actions");
    if (!slot) return;
    printStage.hidden = true;
    if (state.tool === "ads") {
      printStage.innerHTML = "";
      slot.innerHTML = `<div class="canvas-wrap"><canvas id="ad-canvas"></canvas></div><p class="note" id="ad-contrast"></p>`;
      actions.innerHTML = `<button type="button" class="btn" id="dl-ad">Télécharger le PNG</button>`;
      drawAd(b).then((info) => {
        const note = document.getElementById("ad-contrast");
        if (note) note.textContent = info;
        const btn = document.getElementById("dl-ad");
        if (btn) btn.onclick = () => downloadCanvas(document.getElementById("ad-canvas"), `${b.id}-${state.format}.png`);
      });
      return;
    }
    if (state.tool === "doc" || state.tool === "deck") {
      const html = state.tool === "doc" ? sheetHTML(b) : deckHTML(b);
      printStage.innerHTML = html;
      printStage.hidden = true;
      slot.innerHTML = `<div class="doc-preview">${html}</div>`;
      actions.innerHTML = `<button type="button" class="btn" id="do-print">${state.tool === "doc" ? "Imprimer la fiche (PDF)" : "Imprimer les planches (PDF)"}</button>`;
      document.getElementById("do-print").onclick = () => window.print();
      return;
    }
    if (state.tool === "sign") {
      printStage.innerHTML = "";
      const html = signatureHTML(b, true);
      const source = signatureHTML(b, false);
      slot.innerHTML = `<div class="sign" id="sign-preview">${html}</div>
        <p class="note">Le HTML copié pointe les images vers https://analysis.proplace.co/brand/ — elles s’afficheront dans les e-mails une fois la page déployée.</p>
        <pre id="sign-src" style="max-height:180px"></pre>`;
      document.getElementById("sign-src").textContent = source;
      actions.innerHTML = `<button type="button" class="btn" id="copy-sign">Copier le HTML</button>`;
      document.getElementById("copy-sign").onclick = (e) => copy(source, e.currentTarget);
      return;
    }
    slot.innerHTML = `<div class="pair"><canvas id="card-front"></canvas><canvas id="card-back"></canvas></div>`;
    actions.innerHTML = `<button type="button" class="btn" id="dl-front">PNG recto</button><button type="button" class="btn-ghost" id="dl-back">PNG verso</button>`;
    drawCard(b).then(() => {
      document.getElementById("dl-front").onclick = () => downloadCanvas(document.getElementById("card-front"), `${b.id}-carte-recto.png`);
      document.getElementById("dl-back").onclick = () => downloadCanvas(document.getElementById("card-back"), `${b.id}-carte-verso.png`);
    });
  }

  function downloadCanvas(canvas, name) {
    if (!canvas) return;
    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    }, "image/png");
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(src));
      img.src = src;
    });
  }

  function wrap(ctx, text, max) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = "";
    words.forEach((word) => {
      const next = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(next).width > max && cur) {
        lines.push(cur);
        cur = word;
      } else cur = next;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  async function drawLogo(ctx, b, x, y, h, dark) {
    const logo = wordmark(b);
    const file = dark && b.logoOnDarkFile ? b.logoOnDarkFile : logo.file;
    const img = await loadImage(asset(b, file));
    const w = h * (img.width / img.height);
    if (dark && b.logoOnDark === "invert" && !b.logoOnDarkFile) {
      ctx.save();
      ctx.filter = "brightness(0) invert(1)";
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
      return w;
    }
    if (dark && b.logoOnDark === "chip") {
      const pad = h * 0.28;
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, x, y - pad * 0.2, w + pad * 2, h + pad * 1.1, Math.min(12, h * 0.25));
      ctx.fill();
      ctx.drawImage(img, x + pad, y + pad * 0.15, w, h);
      return w + pad * 2;
    }
    ctx.drawImage(img, x, y, w, h);
    return w;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  async function drawAd(b) {
    const fmt = FORMATS.find((f) => f.id === state.format) || FORMATS[0];
    const canvas = document.getElementById("ad-canvas");
    canvas.width = fmt.w;
    canvas.height = fmt.h;
    const ctx = canvas.getContext("2d");
    const accent = primary(b);
    const grounds = { ink: inkOf(b), paper: paperOf(b), accent };
    const bg = grounds[state.ground] || grounds.ink;
    const dark = lum(bg) < 0.45;
    const text = bestText(bg);
    const family = b.id === "sosuites" ? "Georgia" : fontOf(b);
    try { await document.fonts.load(`700 64px "${family}"`); } catch (e) { /* system fallback */ }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, fmt.w, fmt.h);
    ctx.fillStyle = accent;
    ctx.globalAlpha = dark ? 0.22 : 0.16;
    ctx.beginPath();
    ctx.arc(fmt.w * 0.88, fmt.h * 0.1, Math.min(fmt.w, fmt.h) * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const banner = fmt.h / fmt.w < 0.22;
    const story = fmt.h / fmt.w > 1.3;
    const margin = banner ? Math.round(fmt.h * 0.16) : Math.round(Math.min(fmt.w, fmt.h) * (story ? 0.07 : 0.06));
    const logoH = banner ? Math.round(fmt.h * 0.52) : Math.round(Math.min(fmt.w, fmt.h) * (story ? 0.055 : 0.07));
    let logoW = 0;
    try { logoW = await drawLogo(ctx, b, margin, banner ? (fmt.h - logoH) / 2 : margin, logoH, dark); }
    catch (e) { logoW = 0; }
    const ctaH = banner ? Math.round(fmt.h * 0.46) : Math.round(Math.min(fmt.w, fmt.h) * 0.075);
    const ctaPad = ctaH * 0.7;
    ctx.font = `700 ${Math.round(ctaH * 0.42)}px "${family}", sans-serif`;
    const ctaW = Math.ceil(ctx.measureText(state.fields.cta || " ").width + ctaPad * 2);
    const ctaX = fmt.w - margin - ctaW;
    const ctaY = banner ? (fmt.h - ctaH) / 2 : fmt.h - margin - ctaH;
    const ctaBg = accent;
    const ctaFg = bestText(ctaBg);
    ctx.fillStyle = ctaBg;
    roundRect(ctx, ctaX, ctaY, ctaW, ctaH, pill(b) ? ctaH / 2 : 8);
    ctx.fill();
    ctx.fillStyle = ctaFg;
    ctx.textBaseline = "middle";
    ctx.fillText(state.fields.cta || "", ctaX + ctaPad, ctaY + ctaH / 2);
    const textX = banner ? margin + logoW + margin * 0.6 : margin;
    const textMax = banner ? ctaX - textX - margin * 0.5 : fmt.w - margin * 2;
    const titleSize = banner ? Math.round(fmt.h * 0.28) : Math.round(Math.min(fmt.w, fmt.h) * (story ? 0.078 : 0.07));
    ctx.fillStyle = text;
    ctx.textBaseline = "top";
    ctx.font = `700 ${titleSize}px "${family}", sans-serif`;
    let lines = wrap(ctx, state.fields.title, textMax);
    const titleTop = banner ? (fmt.h - titleSize) / 2 - 2 : margin + logoH + margin * 0.9;
    const maxLines = banner ? 1 : (story ? 5 : 3);
    lines = lines.slice(0, maxLines);
    lines.forEach((line, i) => ctx.fillText(line, textX, titleTop + i * titleSize * 1.08));
    if (!banner) {
      const subSize = Math.round(titleSize * 0.42);
      ctx.globalAlpha = 0.82;
      ctx.font = `500 ${subSize}px "${family}", sans-serif`;
      const subTop = titleTop + lines.length * titleSize * 1.08 + subSize * 0.6;
      const subLines = wrap(ctx, state.fields.subtitle, textMax).slice(0, story ? 4 : 2);
      subLines.forEach((line, i) => ctx.fillText(line, margin, subTop + i * subSize * 1.35));
      ctx.globalAlpha = 1;
    }
    const ratio = contrast(bg, text);
    const ctaRatio = contrast(ctaBg, ctaFg);
    return `Texte ${ratio.toFixed(1)}:1 sur le fond, bouton ${ctaRatio.toFixed(1)}:1. ${aa(ratio) ? "AA texte." : "AA large seulement — raccourcir ou changer le fond."} Marge ${margin}px.`;
  }

  function sheetHTML(b) {
    const accent = primary(b);
    const logo = asset(b, wordmark(b).file);
    const family = cssFont(b).replace(/"/g, "'");
    return `<article class="sheet" style="font-family:${family}">
      <header>
        <img src="${esc(logo)}" alt="${esc(b.name)}">
        <span class="kicker">${esc(b.site.replace(/^https?:\/\//, ""))}</span>
      </header>
      <h2>${esc(state.fields.title)}</h2>
      <p class="lead">${esc(state.fields.subtitle)}</p>
      <ul>${points().map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      <p class="proof">${esc(state.fields.proof)}</p>
      <div class="cta-bar" style="background:${accent};color:${bestText(accent)};border-radius:${pill(b) ? "999px" : "8px"}">${esc(state.fields.cta)}</div>
      <p class="kicker" style="margin-top:auto">${esc(state.fields.name)} · ${esc(state.fields.role)}</p>
    </article>`;
  }
  function deckHTML(b) {
    const accent = primary(b);
    const ink = inkOf(b);
    const logo = asset(b, wordmark(b).file);
    const family = cssFont(b).replace(/"/g, "'");
    const invert = b.logoOnDark === "invert" ? "filter:brightness(0) invert(1)" : "";
    const logoOnDark = b.logoOnDark === "chip"
      ? `<span style="background:#fff;border-radius:10px;padding:8px 12px;display:inline-flex"><img src="${esc(logo)}" alt=""></span>`
      : `<img src="${esc(logo)}" alt="" style="${invert}">`;
    const slide = (extra, inner) => `<section class="slide ${extra}" style="font-family:${family};background:${extra ? ink : "#fff"};color:${extra ? "#fff" : ink}">${inner}</section>`;
    return [
      slide("cover", `<header>${logoOnDark}<span class="kicker" style="color:${accent}">${esc(b.name)}</span></header><h2>${esc(state.fields.title)}</h2><p style="font-size:22px;max-width:28ch;margin:0">${esc(state.fields.subtitle)}</p>`),
      slide("", `<header><img src="${esc(logo)}" alt=""><span class="kicker">01</span></header><h2 style="color:${ink}">${esc(state.fields.subtitle)}</h2><p style="font-size:20px;max-width:34ch">${esc(t(b.promise))}</p>`),
      slide("", `<header><img src="${esc(logo)}" alt=""><span class="kicker">02</span></header><h2 style="font-size:32px">Ce que ça change</h2><ul>${points().map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`),
      slide("end", `<header>${logoOnDark}<span class="kicker" style="color:${accent}">03</span></header><h2>${esc(state.fields.cta)}</h2><p style="font-size:20px;max-width:32ch">${esc(state.fields.proof)}</p><p class="kicker">${esc(state.fields.site)}</p>`)
    ].join("");
  }

  function signatureHTML(b, preview) {
    const accent = primary(b);
    const logoFile = wordmark(b).file;
    const src = preview ? asset(b, logoFile) : `https://analysis.proplace.co/brand/${b.id}/${logoFile}`;
    const family = cssFont(b).replace(/"/g, "'");
    const rows = [state.fields.phone, state.fields.email, state.fields.site].filter(Boolean)
      .map((line) => `<div style="font-size:13px;line-height:1.45;color:#3d3936">${esc(line)}</div>`).join("");
    return `<table cellpadding="0" cellspacing="0" style="font-family:${family};color:#201e1d"><tr>
      <td style="padding:0 14px 0 0;border-right:3px solid ${accent};vertical-align:middle">
        <img src="${esc(src)}" alt="${esc(b.name)}" height="36" style="display:block;height:36px;width:auto;border:0">
      </td>
      <td style="padding:0 0 0 14px;vertical-align:middle">
        <div style="font-size:16px;font-weight:700;letter-spacing:-0.02em">${esc(state.fields.name)}</div>
        <div style="font-size:13px;font-weight:600;color:${accent}">${esc(state.fields.role)}</div>
        ${rows}
      </td>
    </tr></table>`;
  }

  async function drawCard(b) {
    const front = document.getElementById("card-front");
    const back = document.getElementById("card-back");
    [front, back].forEach((c) => { c.width = 1050; c.height = 600; });
    const accent = primary(b);
    const ink = inkOf(b);
    const paper = paperOf(b);
    const family = b.id === "sosuites" ? "Georgia" : fontOf(b);
    try { await document.fonts.load(`700 48px "${family}"`); } catch (e) { /* ignore */ }
    const ctx = front.getContext("2d");
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, 1050, 600);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 16, 600);
    try { await drawLogo(ctx, b, 56, 48, 46, false); } catch (e) { /* ignore */ }
    ctx.fillStyle = ink;
    ctx.font = `700 54px "${family}", sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(state.fields.name || b.name, 56, 250);
    ctx.fillStyle = accent;
    ctx.font = `600 22px "${family}", sans-serif`;
    ctx.fillText(state.fields.role || "", 56, 320);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.75;
    ctx.font = `500 20px "${family}", sans-serif`;
    ctx.fillText(state.fields.title || "", 56, 356);
    ctx.globalAlpha = 1;
    const lines = [state.fields.phone, state.fields.email, state.fields.site].filter(Boolean);
    ctx.font = `500 22px "${family}", sans-serif`;
    lines.forEach((line, i) => {
      const y = 430 + i * 40;
      ctx.fillStyle = accent;
      roundRect(ctx, 56, y, 28, 28, 6);
      ctx.fill();
      ctx.fillStyle = bestText(accent);
      ctx.font = `700 14px "${family}", sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), 65, y + 14);
      ctx.fillStyle = ink;
      ctx.font = `500 22px "${family}", sans-serif`;
      ctx.fillText(line, 98, y + 14);
      ctx.textBaseline = "top";
    });

    const bx = back.getContext("2d");
    bx.fillStyle = ink;
    bx.fillRect(0, 0, 1050, 600);
    bx.fillStyle = accent;
    bx.globalAlpha = 0.9;
    bx.beginPath();
    bx.arc(900, 80, 220, 0, Math.PI * 2);
    bx.fill();
    bx.globalAlpha = 1;
    try { await drawLogo(bx, b, 56, 64, 48, true); } catch (e) { /* ignore */ }
    bx.fillStyle = "#ffffff";
    bx.font = `700 48px "${family}", sans-serif`;
    const backLines = wrap(bx, state.fields.title, 780).slice(0, 3);
    backLines.forEach((line, i) => bx.fillText(line, 56, 240 + i * 58));
    bx.fillStyle = accent;
    bx.font = `600 22px "${family}", sans-serif`;
    bx.fillText(state.fields.site || "", 56, 500);
  }

  Promise.all(IDS.map((id) => fetch(`${id}/brand.json`).then((r) => {
    if (!r.ok) throw new Error(id);
    return r.json();
  }))).then((list) => {
    list.forEach((b) => { state.brands[b.id] = b; });
    render();
  }).catch((err) => {
    hub.innerHTML = `<p class="boot">Impossible de lire les manifestes (${esc(err.message)}). Ouvrir la page via le site, pas en fichier local.</p>`;
  });
})();
