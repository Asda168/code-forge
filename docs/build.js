#!/usr/bin/env node
// AstaIDE documentation builder (no dependencies).
//   node docs/build.js            builds docs/**/*.md  ->  backend/core/docs_site/   (served by Django at /docs/)
//   node docs/build.js --check    builds, then verifies every page, link, anchor and image (exit 1 on any problem)
// Pages are listed in docs/nav.json; each page is docs/<category>/<page>.md with a small front matter (title, description).
// Two placeholders are generated from the app's source so they cannot drift: {{shortcuts}} and {{settings-defaults}}.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), SRC = __dirname, OUT = path.join(ROOT, 'backend', 'core', 'docs_site');
const BASE = '/docs/', REPO = 'https://github.com/Asda168/code-forge', SITE = 'https://astaide.vercel.app';
const nav = JSON.parse(fs.readFileSync(path.join(SRC, 'nav.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[`*_]/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
const problems = [];
const pages = [];                                         // flat, in reading order
for (const c of nav) for (const p of c.pages) pages.push({ ...p, cat: c.slug, catTitle: c.title, url: `${BASE}${c.slug}/${p.slug}/`, file: path.join(SRC, c.slug, p.slug + '.md') });
const byFile = new Map(pages.map((p) => [path.resolve(p.file), p]));

// ---- generated placeholders (read straight from desktop/src/main.js) --------------------------------------------------------
const mainJs = fs.readFileSync(path.join(ROOT, 'desktop', 'src', 'main.js'), 'utf8');
const grab = (name) => { const m = mainJs.match(new RegExp('const ' + name + ' = \\{[\\s\\S]*?\\n\\};')); if (!m) throw new Error('cannot find ' + name + ' in main.js'); return new Function('return ' + m[0].replace(/^const \w+ = /, '').replace(/;$/, ''))(); };
const DEFAULT_KEYS = grab('DEFAULT_KEYS'), KEY_META = grab('KEY_META'), DEFAULT_SETTINGS = grab('DEFAULT_SETTINGS');
const pretty = (k) => k.split(' ').map((c) => c.split('+').map((x) => ({ mod: 'Ctrl/Cmd', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', '`': '`', '\\': '\\' })[x] || (x.length === 1 ? x.toUpperCase() : x[0].toUpperCase() + x.slice(1))).join('+')).join(', then ');
function shortcutsMd() {
  const groups = {}; for (const [id, [g, title]] of Object.entries(KEY_META)) (groups[g] = groups[g] || []).push([id, title]);
  return Object.entries(groups).map(([g, cmds]) => `## ${g}\n\n| Command | Default shortcut | Command id (for keyboard.json) |\n|---|---|---|\n` + cmds.map(([id, t]) => `| ${t} | ${DEFAULT_KEYS[id] ? '[[' + pretty(DEFAULT_KEYS[id]).replace(/, then /g, ']], then [[') + ']]' : '*none*'} | \`${id}\` |`).join('\n')).join('\n\n');
}
function settingsDefaultsMd() {
  return '```json\n' + JSON.stringify(DEFAULT_SETTINGS, null, 2) + '\n```';
}

// ---- markdown (the subset the docs use) -----------------------------------------------------------------------------------
function inline(s, ctx) {
  const codes = []; s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(`<code>${esc(c)}</code>`); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = s.replace(/<kbd>(.*?)<\/kbd>/g, (_, k) => { codes.push('<kbd>' + esc(k) + '</kbd>'); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = esc(s);
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_, k) => `<kbd>${k}</kbd>`);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${resolveAsset(src, ctx)}" alt="${alt}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => `<a href="${resolveLink(href, ctx)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
}
function resolveLink(href, ctx) {
  if (/^(https?:|mailto:|#|\/)/.test(href)) { if (href.startsWith('#')) ctx.anchors.push([ctx.page.url, href.slice(1)]); return esc(href); }
  const [file, hash] = href.split('#'), abs = path.resolve(path.dirname(ctx.page.file), file), t = byFile.get(abs);
  if (!t) { problems.push(`${ctx.page.url}: broken link ${href}`); return '#'; }
  if (hash) ctx.anchors.push([t.url, hash]);
  return t.url + (hash ? '#' + hash : '');
}
function resolveAsset(src, ctx) {
  if (/^(https?:|\/)/.test(src)) { ctx.images.push(src); return esc(src); }
  const abs = path.resolve(path.dirname(ctx.page.file), src);
  if (!fs.existsSync(abs)) problems.push(`${ctx.page.url}: missing image ${src}`);
  const rel = path.relative(SRC, abs).replace(/\\/g, '/'); return BASE + rel;
}
function render(md, ctx) {
  const lines = md.replace(/\r\n/g, '\n').split('\n'), out = [], toc = []; let i = 0; const ids = new Set();
  const para = (buf) => buf.length && out.push(`<p>${inline(buf.join(' '), ctx)}</p>`);
  const listAt = (indent) => {                                        // ul / ol with nesting by 2+ spaces
    const first = lines[i], ordered = /^\s*\d+\.\s/.test(first), tag = ordered ? 'ol' : 'ul', items = [];
    while (i < lines.length) {
      const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/); if (!m || m[1].length < indent || (m[1].length === indent && (/\d/.test(m[2]) !== ordered))) break;
      if (m[1].length > indent) { items[items.length - 1] += listAt(m[1].length); continue; }
      let text = m[3]; i++;
      while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s/.test(lines[i]) && lines[i].search(/\S/) > indent) { text += ' ' + lines[i].trim(); i++; }
      items.push(inline(text, ctx));
    }
    return `<${tag}>` + items.map((t) => `<li>${t}</li>`).join('') + `</${tag}>`;
  };
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^```(\w*)\s*$/))) { const code = []; i++; while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]); i++; const lang = m[1] || 'text';
      out.push(`<div class="code"><div class="code-h"><span>${esc(lang)}</span><button type="button" class="copy" aria-label="Copy code">Copy</button></div><pre><code class="language-${esc(lang)}">${esc(code.join('\n'))}</code></pre></div>`); continue; }
    if ((m = l.match(/^(#{2,4})\s+(.*)$/))) { const level = m[1].length; let id = slugify(m[2]); for (let n = 2; ids.has(id); n++) id = slugify(m[2]) + '-' + n; ids.add(id);
      if (level <= 3) toc.push({ level, id, text: m[2].replace(/`/g, '') }); out.push(`<h${level} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${inline(m[2], ctx)}</h${level}>`); i++; continue; }
    if (/^---+\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (/^\|.*\|\s*$/.test(l) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|')); const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="tablewrap"><table><thead><tr>${head.map((c) => `<th>${inline(c, ctx)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, ctx)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue; }
    if (/^>\s?/.test(l)) { const q = []; while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      const kind = (q[0].match(/^\*\*(Note|Tip|Warning|Important|Security)[:.]?\*\*/i) || [])[1]; out.push(`<blockquote class="callout${kind ? ' ' + kind.toLowerCase() : ''}">${render(q.join('\n'), { ...ctx, nested: true }).html}</blockquote>`); continue; }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) { out.push(listAt(l.search(/\S/))); continue; }
    const buf = []; while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|```|>|\||---+\s*$)/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) buf.push(lines[i++].trim()); para(buf);
  }
  return { html: out.join('\n'), toc };
}
function frontMatter(text) { const m = text.match(/^---\n([\s\S]*?)\n---\n/); const meta = {}; if (m) m[1].split('\n').forEach((l) => { const k = l.match(/^(\w+):\s*(.*)$/); if (k) meta[k[1]] = k[2].replace(/^["']|["']$/g, ''); }); return { meta, body: m ? text.slice(m[0].length) : text }; }
const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

// ---- page shell -------------------------------------------------------------------------------------------------------------
const logo = `<img src="${BASE}assets/logo.png" width="26" height="26" alt="" />`;
function sidebarHtml(cur) {
  return nav.map((c) => { const open = c.slug === cur.cat; return `<div class="cat${open ? ' open' : ''}"><button type="button" class="cat-h" aria-expanded="${open}"><span>${esc(c.title)}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button><ul>${c.pages.map((p) => { const u = `${BASE}${c.slug}/${p.slug}/`; return `<li><a href="${u}"${u === cur.url ? ' aria-current="page" class="cur"' : ''}>${esc(p.title)}</a></li>`; }).join('')}</ul></div>`; }).join('');
}
function shell({ title, desc, url, crumbs, body, toc, prev, next, cur, landing }) {
  const tocHtml = toc && toc.length ? `<nav class="toc" aria-label="On this page"><h2>On this page</h2><ul>${toc.map((t) => `<li class="l${t.level}"><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ul></nav>` : '';
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}${landing ? '' : ' | AstaIDE Docs'}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${url}"><meta name="theme-color" content="#0a0a0b">
<meta property="og:title" content="${esc(title)} | AstaIDE Docs"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="article"><meta property="og:url" content="${SITE}${url}"><meta property="og:image" content="${SITE}/og.png">
<link rel="icon" href="${BASE}assets/logo.png">
<script>try{var t=localStorage.getItem('asta-docs-theme');if(!t)t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t}catch(e){}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${BASE}assets/docs.css">
</head>
<body>
<div id="progress" aria-hidden="true"></div>
<a class="skip" href="#content">Skip to content</a>
<header class="top">
  <button type="button" class="icon menu-btn" id="menu-btn" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
  <a class="brand" href="/" aria-label="Asta IDE home">${logo}<b>AstaIDE</b></a><a class="brand-docs" href="${BASE}">Docs</a>
  <button type="button" class="search-btn" id="search-btn" aria-label="Search documentation"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Search docs</span><kbd>Ctrl K</kbd></button>
  <span class="grow"></span>
  <a class="toplink" href="/#download">Download</a><a class="toplink gh" href="${REPO}" target="_blank" rel="noopener">GitHub</a>
  <button type="button" class="icon" id="theme-btn" aria-label="Switch between dark and light theme" title="Toggle theme"><svg class="i-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg><svg class="i-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>
</header>
<div class="layout">
  <aside id="sidebar" class="side" aria-label="Documentation navigation">${sidebarHtml(cur || {})}</aside>
  <div class="scrim" id="scrim"></div>
  <main id="content" class="main">
    ${crumbs ? `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.map(([t, u], i) => `<li>${u && i < crumbs.length - 1 ? `<a href="${u}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`}</li>`).join('')}</ol></nav>` : ''}
    <article class="prose">${body}</article>
    ${!landing && cur ? `<div class="edit"><a href="${REPO}/edit/main/docs/${cur.cat}/${cur.slug}.md" target="_blank" rel="noopener">Edit this page on GitHub</a></div>` : ''}
    ${prev || next ? `<nav class="pager" aria-label="Previous and next page">${prev ? `<a class="prev" href="${prev.url}"><small>Previous</small><span>${esc(prev.title)}</span></a>` : '<span></span>'}${next ? `<a class="next" href="${next.url}"><small>Next</small><span>${esc(next.title)}</span></a>` : '<span></span>'}</nav>` : ''}
    <footer class="foot"><span>AstaIDE ${esc(require('../desktop/package.json').version)} documentation</span><a href="/">Home</a><a href="/#download">Download</a><a href="${REPO}/issues" target="_blank" rel="noopener">Report an issue</a></footer>
  </main>
  <aside class="rail">${tocHtml}</aside>
</div>
<div class="modal" id="search-modal" hidden role="dialog" aria-modal="true" aria-label="Search documentation"><div class="modal-box"><div class="modal-in"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="search-input" type="search" placeholder="Search the documentation…" autocomplete="off" aria-label="Search the documentation" spellcheck="false"><kbd>Esc</kbd></div><ul id="search-results" role="listbox"></ul><div class="modal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to open</span></div></div></div>
<script src="${BASE}assets/docs.js" defer></script>
</body></html>`;
}

// ---- build -----------------------------------------------------------------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.copyFileSync(path.join(SRC, 'site', 'docs.css'), path.join(OUT, 'assets', 'docs.css')); fs.copyFileSync(path.join(SRC, 'site', 'docs.js'), path.join(OUT, 'assets', 'docs.js'));
fs.copyFileSync(path.join(ROOT, 'desktop', 'assets', 'asda.png'), path.join(OUT, 'assets', 'logo.png'));
const shotDir = path.join(SRC, 'assets', 'screenshots'); if (fs.existsSync(shotDir)) { fs.mkdirSync(path.join(OUT, 'assets', 'screenshots'), { recursive: true }); for (const f of fs.readdirSync(shotDir)) fs.copyFileSync(path.join(shotDir, f), path.join(OUT, 'assets', 'screenshots', f)); }
const index = [], allAnchors = [], allImages = [], ids = new Map();
pages.forEach((p, n) => {
  if (!fs.existsSync(p.file)) { problems.push(`${p.url}: missing source ${path.relative(ROOT, p.file)}`); return; }
  const { meta, body: raw } = frontMatter(fs.readFileSync(p.file, 'utf8'));
  const ctx = { page: p, anchors: [], images: [] };
  const md = raw.replace('{{shortcuts}}', shortcutsMd()).replace('{{settings-defaults}}', settingsDefaultsMd());
  const { html, toc } = render(md, ctx);
  const title = meta.title || p.title, desc = meta.description || p.desc || title;
  const body = `<p class="eyebrow">${esc(p.catTitle)}</p><h1>${esc(title)}</h1>${desc ? `<p class="lead">${esc(desc)}</p>` : ''}${html}`;
  const dir = path.join(OUT, p.cat, p.slug); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), shell({ title, desc, url: p.url, crumbs: [['Docs', BASE], [p.catTitle, `${BASE}${p.cat}/`], [title, p.url]], body, toc, prev: pages[n - 1], next: pages[n + 1], cur: p }));
  ids.set(p.url, new Set(toc.map((t) => t.id).concat([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1])))); allAnchors.push(...ctx.anchors); allImages.push(...ctx.images.map((s) => [p.url, s]));
  index.push({ t: title, u: p.url, c: p.catTitle, d: desc, x: plain(html).slice(0, 700), k: '' });
  const secs = html.split(/(?=<h[23] id=)/).slice(1); for (const s of secs) { const m = s.match(/^<h[23] id="([^"]+)">(?:<a[^>]*>#<\/a>)?(.*?)<\/h[23]>/); if (m) index.push({ t: plain(m[2]), u: p.url + '#' + m[1], c: p.catTitle + ' › ' + title, d: '', x: plain(s).slice(0, 300), k: '' }); }
});
// category landing pages + docs home
for (const c of nav) {
  const body = `<p class="eyebrow">Documentation</p><h1>${esc(c.title)}</h1><p class="lead">${esc(c.desc || '')}</p><div class="cards">${c.pages.map((p) => `<a class="card" href="${BASE}${c.slug}/${p.slug}/"><b>${esc(p.title)}</b><span>${esc(p.desc || '')}</span></a>`).join('')}</div>`;
  fs.mkdirSync(path.join(OUT, c.slug), { recursive: true });
  fs.writeFileSync(path.join(OUT, c.slug, 'index.html'), shell({ title: c.title, desc: c.desc || c.title, url: `${BASE}${c.slug}/`, crumbs: [['Docs', BASE], [c.title, `${BASE}${c.slug}/`]], body, cur: { cat: c.slug, url: '' } }));
}
const home = fs.readFileSync(path.join(SRC, 'index.md'), 'utf8'); const hctx = { page: { url: BASE, file: path.join(SRC, 'index.md') }, anchors: [], images: [] };
const hr = render(frontMatter(home).body, hctx);
const cards = (list) => `<div class="cards">${list.map((p) => `<a class="card" href="${p.url}"><b>${esc(p.title)}</b><span>${esc(p.desc || '')}</span></a>`).join('')}</div>`;
const quick = ['getting-started/install', 'getting-started/first-launch', 'tutorials/laravel', 'tutorials/django', 'settings/reference', 'keyboard-shortcuts/reference', 'themes/color-theme', 'extensions/create'].map((k) => pages.find((p) => `${p.cat}/${p.slug}` === k)).filter(Boolean);
const homeBody = `<div class="hero"><img src="${BASE}assets/logo.png" width="64" height="64" alt=""><div><p class="eyebrow">AstaIDE documentation</p><h1>Install it, learn it, make it yours</h1><p class="lead">Everything about the lightweight desktop IDE for Laravel, Python, Django and the modern web: first steps, Git, the terminal, extensions, themes and every setting.</p><p class="hero-act"><a class="btn p" href="${BASE}getting-started/install/">Get started</a><a class="btn s" href="${BASE}settings/reference/">Customization reference</a><button class="btn s" type="button" id="hero-search">Search docs <kbd>Ctrl K</kbd></button></p></div></div><h2 id="quick-links">Quick links</h2>${cards(quick)}${hr.html}<h2 id="all-topics">All topics</h2><div class="cards cats">${nav.map((c) => `<a class="card" href="${BASE}${c.slug}/"><b>${esc(c.title)}</b><span>${esc(c.desc || '')}</span><small>${c.pages.length} pages</small></a>`).join('')}</div>`;
fs.writeFileSync(path.join(OUT, 'index.html'), shell({ title: 'AstaIDE Documentation', desc: 'Install, learn, configure and customize AstaIDE: Git, terminal, extensions, themes, settings and keyboard shortcuts.', url: BASE, crumbs: null, body: homeBody, toc: [{ level: 2, id: 'quick-links', text: 'Quick links' }, { level: 2, id: 'all-topics', text: 'All topics' }], next: pages[0], landing: true, cur: { cat: '', url: BASE } }));
allAnchors.push(...hctx.anchors); ids.set(BASE, new Set(['quick-links', 'all-topics']));
index.push({ t: 'AstaIDE Documentation', u: BASE, c: 'Docs', d: 'Home', x: 'install learn configure customize', k: '' });
fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify(index));
fs.writeFileSync(path.join(OUT, 'pages.json'), JSON.stringify([BASE, ...nav.map((c) => `${BASE}${c.slug}/`), ...pages.map((p) => p.url)]));

// ---- checks ----------------------------------------------------------------------------------------------------------------
const shotOk = new Set(fs.existsSync(path.join(ROOT, 'backend', 'core', 'seo', 'shots')) ? fs.readdirSync(path.join(ROOT, 'backend', 'core', 'seo', 'shots')).map((f) => '/shots/' + f) : []);
for (const [from, a] of allAnchors) { const set = ids.get(from); if (!set || !set.has(a)) problems.push(`${from}: anchor #${a} does not exist`); }
for (const [from, s] of allImages) if (s.startsWith('/shots/') && !shotOk.has(s)) problems.push(`${from}: unknown screenshot ${s}`);
const orphan = fs.readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory() && !['site', 'assets'].includes(d.name)).flatMap((d) => fs.readdirSync(path.join(SRC, d.name)).filter((f) => f.endsWith('.md')).map((f) => `${d.name}/${f}`)).filter((f) => !pages.some((p) => `${p.cat}/${p.slug}.md` === f));
orphan.forEach((f) => problems.push(`docs/${f} is not listed in nav.json`));
console.log(`Built ${pages.length} pages + ${nav.length} category pages + home -> ${path.relative(ROOT, OUT)} (${index.length} search entries)`);
if (problems.length) { console.log('\nProblems:\n - ' + problems.join('\n - ')); if (process.argv.includes('--check')) process.exit(1); }
else console.log('All links, anchors, images and nav entries OK.');
