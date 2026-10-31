// AstaIDE docs: theme, sidebar, progress bar, copy buttons, syntax highlighting, table-of-contents tracking and search (Ctrl+K or /).
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  // theme
  $('#theme-btn').addEventListener('click', () => { const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = t; try { localStorage.setItem('asta-docs-theme', t); } catch (e) { /* private mode */ } });
  // sidebar: categories expand/collapse; mobile drawer
  $$('.cat-h').forEach((b) => b.addEventListener('click', () => { const c = b.parentElement, o = c.classList.toggle('open'); b.setAttribute('aria-expanded', String(o)); }));
  const side = $('#sidebar'), scrim = $('#scrim'), mb = $('#menu-btn');
  const drawer = (on) => { side.classList.toggle('open', on); scrim.classList.toggle('on', on); mb.setAttribute('aria-expanded', String(on)); };
  mb.addEventListener('click', () => drawer(!side.classList.contains('open'))); scrim.addEventListener('click', () => drawer(false));
  const cur = $('.cat li a.cur'); if (cur) cur.scrollIntoView({ block: 'center' });
  // reading progress
  const bar = $('#progress'); let tick = false;
  const onScroll = () => { if (tick) return; tick = true; requestAnimationFrame(() => { const h = root.scrollHeight - innerHeight; bar.style.width = (h > 0 ? Math.min(100, (scrollY / h) * 100) : 0) + '%'; tick = false; }); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  // table of contents: highlight the section being read
  const links = $$('.toc a'); if (links.length && 'IntersectionObserver' in window) {
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { links.forEach((l) => l.classList.remove('on')); const a = map.get(e.target.id); if (a) a.classList.add('on'); } }); }, { rootMargin: '-70px 0px -70% 0px' });
    map.forEach((_, id) => { const h = document.getElementById(id); if (h) io.observe(h); });
  }
  // copy buttons
  $$('.copy').forEach((b) => b.addEventListener('click', async () => {
    const code = b.closest('.code').querySelector('code').textContent;
    try { await navigator.clipboard.writeText(code); } catch (e) { const t = document.createElement('textarea'); t.value = code; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
    b.textContent = 'Copied'; b.classList.add('ok'); setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('ok'); }, 1400);
  }));
  // syntax highlighting (small tokenizer, no dependency)
  const KW = {
    js: 'const let var function return if else for while await async new class import from export default try catch throw true false null undefined this typeof',
    php: 'php function return if else elseif foreach for while new class public private protected static use namespace extends implements echo true false null array fn match',
    python: 'def class return if elif else for while import from as with try except raise pass lambda None True False in not and or is yield async await',
    bash: 'if then else fi for do done while case esac function in cd export echo set source sudo',
    sql: 'select from where insert into values update set delete create table alter drop index join left right inner on group by order limit and or not null primary key references default as distinct having union',
    json: 'true false null', html: '', css: '', text: '', env: '',
  };
  const ALIAS = { javascript: 'js', ts: 'js', typescript: 'js', jsx: 'js', py: 'python', sh: 'bash', shell: 'bash', powershell: 'bash', ps1: 'bash', cmd: 'bash', batch: 'bash', mysql: 'sql', yml: 'text', yaml: 'text', blade: 'html', xml: 'html', vue: 'html' };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  $$('pre code').forEach((el) => {
    let lang = (el.className.match(/language-(\w+)/) || [])[1] || 'text'; lang = ALIAS[lang] || lang; if (!(lang in KW)) return;
    const kw = new Set(KW[lang].split(' ').filter(Boolean)), sql = lang === 'sql', src = el.textContent;
    const re = lang === 'html' ? /(<!--[\s\S]*?-->)|(<\/?[\w:-]+)|("[^"]*"|'[^']*')|(\s[\w:@.-]+(?==))/g
      : lang === 'css' ? /(\/\*[\s\S]*?\*\/)|("[^"]*"|'[^']*')|(#[0-9a-fA-F]{3,8}\b|\b\d[\w.%]*)|([.#]?[\w-]+(?=\s*[:{]))/g
      : new RegExp('(' + (lang === 'python' || lang === 'bash' ? '#.*' : lang === 'sql' ? '--.*' : '\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\/' + (lang === 'php' ? '|#.*' : '')) + ')|("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`)|(\\$[\\w]+|\\$\\{[^}]*\\}|--?[a-zA-Z][\\w-]*(?=[\\s=]|$))|(\\b\\d[\\d._]*\\b)|(\\b[A-Za-z_][\\w]*\\b)', 'g');
    let out = '', last = 0, m; re.lastIndex = 0;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index)); last = m.index + m[0].length; const t = esc(m[0]);
      if (lang === 'html') out += m[1] ? `<span class="tok-c">${t}</span>` : m[2] ? `<span class="tok-k">${t}</span>` : m[3] ? `<span class="tok-s">${t}</span>` : `<span class="tok-f">${t}</span>`;
      else if (lang === 'css') out += m[1] ? `<span class="tok-c">${t}</span>` : m[2] ? `<span class="tok-s">${t}</span>` : m[3] ? `<span class="tok-n">${t}</span>` : `<span class="tok-f">${t}</span>`;
      else if (m[1]) out += `<span class="tok-c">${t}</span>`; else if (m[2]) out += `<span class="tok-s">${t}</span>`; else if (m[3]) out += `<span class="tok-v">${t}</span>`; else if (m[4]) out += `<span class="tok-n">${t}</span>`;
      else if (m[5]) out += kw.has(sql ? m[5].toLowerCase() : m[5]) ? `<span class="tok-k">${t}</span>` : (src[last] === '(' ? `<span class="tok-f">${t}</span>` : t);
      else out += t;
      if (m[0] === '') re.lastIndex++;
    }
    if (lang === 'json') { el.innerHTML = out.replace(/(<span class="tok-s">"[^<]*"<\/span>)(?=\s*:)/g, (x) => x.replace('tok-s', 'tok-f')); return; }
    el.innerHTML = out + esc(src.slice(last));
  });
  // search
  const modal = $('#search-modal'), input = $('#search-input'), list = $('#search-results'); let data = null, sel = 0, items = [];
  const open = async () => { modal.hidden = false; input.value = ''; input.focus(); if (!data) { try { data = await (await fetch('/docs/search-index.json')).json(); } catch (e) { data = []; list.innerHTML = '<li class="empty">Search index could not be loaded.</li>'; return; } } run(); };
  const close = () => { modal.hidden = true; };
  const hl = (s, ws) => { s = esc(s); ws.forEach((w) => { s = s.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); }); return s; };
  function run() {
    const q = input.value.trim().toLowerCase(), ws = q.split(/\s+/).filter(Boolean);
    if (!ws.length) { items = data.filter((d) => !d.u.includes('#')).slice(0, 8); }
    else items = data.map((d) => { const t = d.t.toLowerCase(), x = (d.x + ' ' + d.d + ' ' + d.c).toLowerCase(); let s = 0; for (const w of ws) { if (t.includes(w)) s += t.startsWith(w) ? 12 : 8; else if (x.includes(w)) s += 2; else return null; } if (!d.u.includes('#')) s += 1; return { d, s }; }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 12).map((o) => o.d);
    sel = 0;
    list.innerHTML = items.length ? items.map((d, i) => `<li role="option" class="${i ? '' : 'sel'}"><a href="${d.u}"><b>${hl(d.t, ws)}</b><small>${esc(d.c)}</small>${ws.length && d.x ? `<p>${hl(snip(d.x, ws), ws)}</p>` : ''}</a></li>`).join('') : '<li class="empty">No results. Try fewer or different words.</li>';
  }
  const snip = (x, ws) => { const i = Math.max(0, x.toLowerCase().indexOf(ws[0]) - 40); return (i ? '… ' : '') + x.slice(i, i + 130) + '…'; };
  const move = (d) => { const lis = $$('li', list); if (!lis.length || lis[0].classList.contains('empty')) return; lis[sel].classList.remove('sel'); sel = (sel + d + lis.length) % lis.length; lis[sel].classList.add('sel'); lis[sel].scrollIntoView({ block: 'nearest' }); };
  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); move(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); } else if (e.key === 'Enter' && items[sel]) { location.href = items[sel].u; } });
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) close(); });
  $('#search-btn').addEventListener('click', open); const hs = $('#hero-search'); if (hs) hs.addEventListener('click', open);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); modal.hidden ? open() : close(); }
    else if (e.key === '/' && modal.hidden && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
  });
})();
