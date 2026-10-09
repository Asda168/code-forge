// Asta renderer core: state, helpers, themes, Monaco, editor groups & tabs.
const CF = (window.CF = {
  S: {
    root: null,
    settings: {},
    groups: [],
    active: 0,
    models: new Map(),
    platform: {},
    vertical: false,
  },
});
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "html") e.innerHTML = v;
    else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  kids
    .flat()
    .forEach(
      (c) => c != null && e.append(c.nodeType ? c : document.createTextNode(c)),
    );
  return e;
};
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const sep = () => (CF.S.platform.platform === "win32" ? "\\" : "/");
const base = (p) => p.split(/[\\/]/).pop();
const dirOf = (p) =>
  p.slice(0, Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\")));
const join = (a, b) => a.replace(/[\\/]+$/, "") + sep() + b;
const rel = (p) =>
  CF.S.root && p.startsWith(CF.S.root) ? p.slice(CF.S.root.length + 1) : p;
Object.assign(CF, { $, $$, h, esc, base, dirOf, join, rel });

CF.toast = (msg, err) => {
  const t = h("div", { class: "toast" + (err ? " err" : "") }, String(msg));
  document.body.append(t);
  setTimeout(() => t.remove(), err ? 7000 : 3500);
};
CF.guard =
  (fn) =>
  async (...a) => {
    try {
      return await fn(...a);
    } catch (e) {
      CF.toast(
        ((e && e.message) || e).replace(
          /^Error invoking remote method '[^']+': (Error: )?/,
          "",
        ),
        true,
      );
    }
  };

// ---- generic modal ---------------------------------------------------------
CF.closeOverlay = () => {
  const o = $("#overlay");
  o.hidden = true;
  o.innerHTML = "";
  o.className = "";
};
CF.modal = (title, bodyEls, buttons, { wide = false } = {}) => {
  const o = $("#overlay");
  o.innerHTML = "";
  o.className = "center";
  o.hidden = false;
  const d = h(
    "div",
    { class: "dlg" + (wide ? " wide" : "") },
    h("h3", {}, title),
    ...bodyEls,
    h(
      "div",
      { class: "btns" },
      ...buttons.map((b) =>
        h(
          "button",
          {
            class: "btn " + (b.cls || ""),
            onclick: () => (b.run ? b.run(d) : CF.closeOverlay()),
          },
          b.label,
        ),
      ),
    ),
  );
  o.append(d);
  o.onmousedown = (e) => {
    if (e.target === o) CF.closeOverlay();
  };
  const first = $("input,select", d);
  first && first.focus();
  d.addEventListener("keydown", (e) => {
    if (e.key === "Escape") CF.closeOverlay();
    if (e.key === "Enter" && e.target.tagName === "INPUT") {
      const p = $(".btns .btn:last-child", d);
      p && p.click();
    }
  });
  return d;
};
// fields: [{id,label,value,type:'text'|'select'|'check',options}] -> resolves values or null
CF.ask = (title, fields, ok = "OK") =>
  new Promise((res) => {
    const els = fields.map((f) => {
      if (f.type === "check")
        return h(
          "div",
          { class: "chk" },
          h("input", { type: "checkbox", id: "f-" + f.id, checked: !!f.value }),
          h("span", {}, f.label),
        );
      const ctl =
        f.type === "select"
          ? h(
              "select",
              { id: "f-" + f.id },
              f.options.map((o) =>
                h("option", { value: o, selected: o === f.value }, o),
              ),
            )
          : h("input", {
              id: "f-" + f.id,
              type: f.type || "text",
              value: f.value || "",
              placeholder: f.placeholder || "",
            });
      const extra = f.browse
        ? h(
            "button",
            {
              class: "btn sec sm",
              onclick: async () => {
                const p = await cf.ws.pickDir();
                if (p) ctl.value = p;
              },
            },
            "Browse…",
          )
        : null;
      return h(
        "div",
        {},
        h("label", {}, f.label),
        extra
          ? h(
              "div",
              { class: "row", style: "display:flex;gap:6px" },
              ctl,
              extra,
            )
          : ctl,
      );
    });
    CF.modal(title, els, [
      {
        label: "Cancel",
        cls: "sec",
        run: () => {
          CF.closeOverlay();
          res(null);
        },
      },
      {
        label: ok,
        run: (d) => {
          const v = {};
          fields.forEach((f) => {
            const e = $("#f-" + f.id, d);
            v[f.id] = f.type === "check" ? e.checked : e.value;
          });
          CF.closeOverlay();
          res(v);
        },
      },
    ]);
  });
CF.confirm = (msg, ok = "OK") =>
  new Promise((res) =>
    CF.modal(
      "Confirm",
      [h("p", {}, msg)],
      [
        {
          label: "Cancel",
          cls: "sec",
          run: () => {
            CF.closeOverlay();
            res(false);
          },
        },
        {
          label: ok,
          run: () => {
            CF.closeOverlay();
            res(true);
          },
        },
      ],
    ),
  );

// ---- themes ---------------------------------------------------------------
const THEMES = {
  "codeforge-dark": {
    name: "Asta Dark",
    base: "vs-dark",
    ui: {},
    ed: {
      "editor.background": "#0b1020",
      "editor.lineHighlightBackground": "#141c3d",
      "editorCursor.foreground": "#22d3ee",
    },
  },
  "codeforge-light": {
    name: "Asta Light",
    base: "vs",
    ui: {
      "--bg": "#f7f8fc",
      "--side": "#eceff8",
      "--panel": "#f1f3fa",
      "--fg": "#161b33",
      "--mut": "#5d668a",
      "--border": "#d5daec",
      "--hover": "#e1e6f6",
      "--sel": "#cdd8f7",
    },
    ed: { "editor.background": "#f7f8fc" },
  },
  "high-contrast": {
    name: "High Contrast",
    base: "hc-black",
    ui: {
      "--bg": "#000",
      "--side": "#000",
      "--panel": "#000",
      "--fg": "#fff",
      "--mut": "#cfcfcf",
      "--border": "#6fc3df",
      "--hover": "#1a1a1a",
      "--sel": "#05324a",
    },
    ed: {},
  },
  midnight: {
    name: "Midnight",
    base: "vs-dark",
    ui: {
      "--bg": "#05060f",
      "--side": "#090b1a",
      "--panel": "#070916",
      "--border": "#14183a",
      "--hover": "#10142e",
    },
    ed: { "editor.background": "#05060f" },
  },
  vampire: {
    name: "Vampire (Dracula-inspired)",
    base: "vs-dark",
    ui: {
      "--bg": "#272935",
      "--side": "#21222c",
      "--panel": "#232430",
      "--border": "#343746",
      "--hover": "#343746",
      "--sel": "#44475a",
      "--accent": "#bd93f9",
      "--cyan": "#8be9fd",
    },
    ed: {
      "editor.background": "#272935",
      "editor.lineHighlightBackground": "#2f3140",
    },
  },
  solar: {
    name: "Solar (Solarized-inspired)",
    base: "vs",
    ui: {
      "--bg": "#fdf6e3",
      "--side": "#eee8d5",
      "--panel": "#f5eed9",
      "--fg": "#44575f",
      "--mut": "#839496",
      "--border": "#ddd6c1",
      "--hover": "#e6dfc8",
      "--sel": "#d6cfb8",
      "--accent": "#268bd2",
    },
    ed: { "editor.background": "#fdf6e3" },
  },
};
CF.THEMES = THEMES;
// Syntax categories users can recolour in Settings -> Monaco token names (semantic + TextMate-style).
CF.TOKEN_KEYS = [
  ["comment", "Comment", ["comment", "comment.doc"]],
  [
    "class",
    "Class / Type",
    [
      "class",
      "type",
      "type.identifier",
      "entity.name.class",
      "entity.name.type",
      "interface",
      "enum",
    ],
  ],
  [
    "function",
    "Function / Method",
    ["function", "method", "entity.name.function", "support.function"],
  ],
  ["keyword", "Keyword", ["keyword", "keyword.control", "storage"]],
  ["string", "String", ["string", "string.escape"]],
  ["number", "Number", ["number", "number.float", "constant.numeric"]],
  [
    "variable",
    "Variable",
    ["variable", "variable.predefined", "identifier", "parameter"],
  ],
];
CF.applyTheme = (id) => {
  const t = THEMES[id] || THEMES["codeforge-dark"];
  const root = document.documentElement.style;
  [
    "--bg",
    "--side",
    "--panel",
    "--fg",
    "--mut",
    "--accent",
    "--accent2",
    "--cyan",
    "--border",
    "--hover",
    "--sel",
    "--status",
    "--status-fg",
  ].forEach((k) => root.removeProperty(k));
  Object.entries(t.ui).forEach(([k, v]) => root.setProperty(k, v));
  if (window.monaco) {
    const mid = "cf-" + id.replace(/[^a-z0-9-]/gi, "-");
    monaco.editor.defineTheme(mid, {
      base: t.base,
      inherit: true,
      rules: [...(t.rules || []), ...CF.userTokenRules()],
      colors: t.ed,
    });
    monaco.editor.setTheme(mid);
  }
  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue("--bg")
    .trim();
  const lm = bg.match(/^#([0-9a-f]{6})$/i), ln = lm ? parseInt(lm[1], 16) : 0;
  document.documentElement.classList.toggle(
    "ui-light",
    !!lm && 0.299 * (ln >> 16) + 0.587 * ((ln >> 8) & 255) + 0.114 * (ln & 255) > 150,
  );
  CF.S.terms &&
    CF.S.terms.forEach((x) => (x.xterm.options.theme = CF.termTheme()));
  return bg;
};
CF.userTokenRules = () => {
  const tc = (CF.S.settings && CF.S.settings.tokenColors) || {};
  const r = [];
  for (const [k, , toks] of CF.TOKEN_KEYS)
    if (/^#[0-9a-f]{6}$/i.test(tc[k] || ""))
      toks.forEach((token) => r.push({ token, foreground: tc[k].slice(1) }));
  return r;
};
CF.termTheme = () => {
  const cs = getComputedStyle(document.documentElement);
  const g = (v) => cs.getPropertyValue(v).trim();
  const bg = g("--panel");
  const m = bg.match(/^#([0-9a-f]{6})$/i);
  const n = m ? parseInt(m[1], 16) : 0;
  const light =
    m && 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
  const pal = light
    ? {
        black: "#24292f",
        red: "#cf222e",
        green: "#1a7f37",
        yellow: "#9a6700",
        blue: "#0969da",
        magenta: "#8250df",
        cyan: "#1b7c83",
        white: "#6e7781",
        brightBlack: "#57606a",
        brightRed: "#a40e26",
        brightGreen: "#2da44e",
        brightYellow: "#bf8700",
        brightBlue: "#218bff",
        brightMagenta: "#a475f9",
        brightCyan: "#3192aa",
        brightWhite: "#8c959f",
      }
    : {
        black: "#3b4261",
        red: "#f7768e",
        green: "#9ece6a",
        yellow: "#e0af68",
        blue: "#7aa2f7",
        magenta: "#bb9af7",
        cyan: "#7dcfff",
        white: "#c0caf5",
        brightBlack: "#697098",
        brightRed: "#ff899d",
        brightGreen: "#b9f27c",
        brightYellow: "#ffc777",
        brightBlue: "#9ab8ff",
        brightMagenta: "#d1b3ff",
        brightCyan: "#a4daff",
        brightWhite: "#e6ebff",
      };
  const panel = $("#panel");
  if (panel) panel.classList.toggle("t-light", !!light);
  if (light)
    return {
      ...pal,
      background: bg,
      foreground: g("--fg"),
      cursor: g("--cyan"),
      cursorAccent: bg,
      selectionBackground: g("--sel"),
    };
  // dark themes: Zed-like charcoal surface and restrained colours
  return {
    ...pal,
    red: "#f07178",
    green: "#8ccf8c",
    background: "#151515",
    foreground: "#e6e6e6",
    cursor: "#e6e6e6",
    cursorAccent: "#151515",
    selectionBackground: "rgba(115,167,255,0.28)",
  };
};
// Options shared by new terminals and live settings changes (font stack falls back to widely installed monospace fonts).
CF.termOptions = () => {
  const s = CF.S.settings;
  return {
    fontFamily: CF.termFont(),
    fontSize: +s.termFontSize || 13,
    lineHeight: +s.termLineHeight || 1.4,
    cursorStyle: s.termCursorStyle || "block",
    cursorBlink: s.termCursorBlink !== false,
    fontWeight: "400",
    fontWeightBold: "600",
  };
};

// ---- settings ------------------------------------------------------------------
CF.editorOptions = () => {
  const s = CF.S.settings;
  return {
    fontFamily: `"${s.fontFamily}", "JetBrains Mono", Consolas, monospace`,
    fontSize: +s.fontSize,
    fontWeight: String(s.fontWeight),
    lineHeight: Math.round(s.fontSize * s.lineHeight),
    letterSpacing: +s.letterSpacing,
    fontLigatures: !!s.ligatures,
    fontSmoothing: s.smoothFonts ? "antialiased" : "auto",
    minimap: { enabled: !!s.minimap },
    wordWrap: s.wordWrap ? "on" : "off",
    tabSize: +s.tabSize,
    insertSpaces: !!s.insertSpaces,
    bracketPairColorization: { enabled: true },
    cursorSmoothCaretAnimation: "on",
    bracketPairColorization: { enabled: s.bracketColors !== false },
    stickyScroll: { enabled: !!s.stickyScroll, maxLineCount: 5, defaultModel: "outlineModel", scrollWithEditor: true },
    guides: { bracketPairs: true, highlightActiveBracketPair: true, indentation: true, highlightActiveIndentation: true },
    showFoldingControls: "mouseover",
    foldingHighlight: true,
    smoothScrolling: false,
    mouseWheelScrollSensitivity: 1,
    fastScrollSensitivity: 5,
    scrollbar: { useShadows: false, verticalScrollbarSize: 12 },
    renderLineHighlight: "all",
    scrollBeyondLastLine: false,
    automaticLayout: true,
    renderWhitespace: "selection",
    formatOnPaste: true,
    "semanticHighlighting.enabled": true,
  };
};
CF.applySettings = () => {
  const s = CF.S.settings;
  document.body.style.webkitFontSmoothing = s.smoothFonts
    ? "antialiased"
    : "auto";
  CF.S.groups.forEach((g) => g.editor.updateOptions(CF.editorOptions()));
  CF.S.terms &&
    CF.S.terms.forEach((x) => {
      Object.assign(x.xterm.options, CF.termOptions());
      x.fit();
    });
  CF.applyTheme(s.theme);
  $("#app").classList.toggle("no-tabacts", s.tabActions === false);
  $("#app").classList.toggle("no-sidebar", !s.sidebar);
  $("#app").classList.toggle("no-activity", !s.activityBar);
  $("#statusbar").hidden = !s.statusBar;
  $("#sb-font").textContent = s.fontFamily;
  $("#sb-indent").textContent =
    (s.insertSpaces ? "Spaces: " : "Tab Size: ") + s.tabSize;
};
CF.setSetting = async (patch) => {
  const old = CF.S.settings.iconTheme;
  CF.S.settings = await cf.settings.set(patch);
  CF.applySettings();
  if (CF.S.settings.iconTheme !== old) {
    CF.renderTabs();
    CF.refreshTree && CF.refreshTree();
  }
};
CF.fontStep = (d) => {
  const sizes = [
    8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, 32,
  ];
  const cur = CF.S.settings.fontSize;
  let i = sizes.findIndex((x) => x >= cur);
  if (i < 0) i = sizes.length - 1;
  if (d === 0) return CF.setSetting({ fontSize: 14 });
  CF.setSetting({
    fontSize: sizes[Math.min(sizes.length - 1, Math.max(0, i + d))],
  });
};
CF.FONT_SIZES = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, 32,
];

// ---- function-only outline (drives Sticky Scroll) -----------------------------------
// Monaco's standalone editor has no symbol provider for most languages, so Sticky Scroll
// would pin every foldable block (objects, if/for, consts). This returns only function /
// method / class blocks, nested by containment.
const FN_KW = /^(if|for|foreach|while|switch|catch|else|elseif|elif|return|do|try|finally|with|except|await|new|typeof|throw|until|unless|match|using|lock|fixed|loop|when|case|default|synchronized)\b/;
const FN_CLASS = /^(export\s+)?(default\s+)?(abstract\s+|final\s+|public\s+|static\s+)*(class|interface|trait|struct|enum|impl|module|namespace)\b/;
const FN_DECL = /^((export|public|private|protected|static|final|abstract|override|async|default|pub|unsafe|extern)\s+)*(function\*?|def|fn|func|fun|sub)\b/;
const FN_ARROW = /(=>|\bfunction\b\s*\*?\s*\w*\s*\([^)]*\))\s*\{\s*$/;
const FN_METHOD = /^((public|private|protected|static|final|abstract|override|async|get|set|virtual|internal|readonly)\s+)*([\w$<>\[\],.?*&:]+\s+)*[\w$.]+\s*\([^;]*\)\s*(:\s*[\w$<>\[\],.?|& ]+\s*|throws\s+[\w, .]+\s*|const\s*)?\{\s*$/;
CF.isFnHeader = (t) => !FN_KW.test(t) && (FN_CLASS.test(t) || FN_DECL.test(t) || FN_ARROW.test(t) || FN_METHOD.test(t));
// Reduce another provider's symbol tree (the TS worker's) to functions/classes only.
CF.keepFnOnly = (syms, model) => {
  const K = monaco.languages.SymbolKind, keep = new Set([K.Function, K.Method, K.Constructor, K.Class, K.Interface, K.Enum, K.Struct, K.Namespace, K.Module]);
  const vars = new Set([K.Variable, K.Constant, K.Property, K.Field]);
  const walk = (a) => a.flatMap((s) => {
    const kids = walk(s.children || []);
    const head = model.getLineContent(s.range.startLineNumber).trim();
    if (keep.has(s.kind) || (vars.has(s.kind) && CF.isFnHeader(head))) return [{ ...s, children: kids }];
    return kids;
  });
  return walk(syms);
};
CF.fnSymbols = (model) => {
  const n = model.getLineCount();
  if (n > 20000) return [];
  const lines = model.getLinesContent();
  const KW = FN_KW, CLASS = FN_CLASS;
  const isHeader = CF.isFnHeader;
  const pyLike = /^(python|ruby)$/.test(model.getLanguageId());
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = lines[i].trim();
    if (!t || t[0] === '/' || t[0] === '*' || t[0] === '#' && !pyLike) continue;
    if (!isHeader(t)) continue;
    let end = -1;
    if (pyLike) {
      if (!/:\s*(#.*)?$/.test(t)) continue;
      const ind = lines[i].match(/^\s*/)[0].length;
      end = i;
      for (let j = i + 1; j < n; j++) { const l = lines[j]; if (!l.trim()) continue; if (l.match(/^\s*/)[0].length <= ind) break; end = j; }
    } else {
      let depth = 0, started = false, str = '', blk = false;
      scan: for (let j = i; j < Math.min(n, i + 4000); j++) {
        if (!started && j > i + 3) break;
        const l = lines[j];
        for (let k = 0; k < l.length; k++) {
          const c = l[k], d = l[k + 1];
          if (blk) { if (c === '*' && d === '/') { blk = false; k++; } continue; }
          if (str) { if (c === '\\') k++; else if (c === str) str = ''; continue; }
          if (c === '/' && d === '/') break;
          if (c === '/' && d === '*') { blk = true; k++; continue; }
          if (c === '"' || c === "'" || c === '`') { str = c; continue; }
          if (c === '{') { depth++; started = true; } else if (c === '}' && started && --depth === 0) { end = j; break scan; }
        }
        if (str && str !== '`') str = '';
      }
    }
    if (end <= i) continue;
    const name = t.replace(/\s*\{\s*$/, '').replace(/^(export|default|async|public|private|protected|static)\s+/g, '').slice(0, 80);
    out.push({ name, detail: '', kind: CLASS.test(t) ? monaco.languages.SymbolKind.Class : monaco.languages.SymbolKind.Function, tags: [],
      range: { startLineNumber: i + 1, startColumn: 1, endLineNumber: end + 1, endColumn: model.getLineMaxColumn(end + 1) },
      selectionRange: { startLineNumber: i + 1, startColumn: 1, endLineNumber: i + 1, endColumn: model.getLineMaxColumn(i + 1) }, children: [] });
  }
  // nest by containment (out is already ordered by start line)
  const roots = [], stack = [];
  for (const s of out) {
    while (stack.length && stack[stack.length - 1].range.endLineNumber < s.range.startLineNumber) stack.pop();
    (stack.length ? stack[stack.length - 1].children : roots).push(s);
    stack.push(s);
  }
  return roots;
};

// ---- Monaco -----------------------------------------------------------------------
CF.initMonaco = () =>
  new Promise((resolve) => {
    const baseUrl = new URL(
      "../../node_modules/monaco-editor/min",
      location.href,
    ).href;
    require.config({ paths: { vs: baseUrl + "/vs" } });
    window.MonacoEnvironment = {
      getWorkerUrl: () =>
        "data:text/javascript;charset=utf-8," +
        encodeURIComponent(
          `self.MonacoEnvironment={baseUrl:'${baseUrl}/'};importScripts('${baseUrl}/vs/base/worker/workerMain.js');`,
        ),
    };
    require(["vs/editor/editor.main"], () => {
      // Wrap symbol providers registered later (the TS worker's) so they only yield functions/classes.
      const regSym = monaco.languages.registerDocumentSymbolProvider.bind(monaco.languages);
      monaco.languages.registerDocumentSymbolProvider = (sel, p) => {
        if (p.displayName === "Functions") return regSym(sel, p);
        const w = Object.create(p);
        w.provideDocumentSymbols = async (m, t) => {
          const r = await p.provideDocumentSymbols(m, t);
          return r && CF.keepFnOnly(r, m);
        };
        return regSym(sel, w);
      };
      monaco.languages.registerDocumentSymbolProvider("*", {
        displayName: "Functions",
        provideDocumentSymbols: (model) => CF.fnSymbols(model),
      });
      const ts = monaco.languages.typescript;
      ts.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
      ts.javascriptDefaults.setCompilerOptions({
        allowNonTsExtensions: true,
        allowJs: true,
        checkJs: false,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.Preserve,
      });
      ["vue", "blade"].forEach((id) => monaco.languages.register({ id }));
      ["vue", "blade"].forEach((id) =>
        monaco.languages.setLanguageConfiguration(id, {
          comments: { blockComment: ["<!--", "-->"] },
          brackets: [
            ["<", ">"],
            ["{", "}"],
            ["(", ")"],
          ],
          autoClosingPairs: [
            { open: "{", close: "}" },
            { open: "(", close: ")" },
            { open: '"', close: '"' },
            { open: "'", close: "'" },
          ],
        }),
      );
      resolve();
    });
  });
CF.langFor = (p) => {
  const n = base(p).toLowerCase();
  if (n.endsWith(".blade.php")) return "html";
  const ext = n.includes(".") ? n.slice(n.lastIndexOf(".")) : "";
  if (CF.extAssoc && CF.extAssoc[ext]) return CF.extAssoc[ext];
  const map = {
    ".vue": "html",
    ".jsx": "javascript",
    ".tsx": "typescript",
    ".env": "ini",
    ".md": "markdown",
    ".sql": "sql",
    ".php": "php",
    ".py": "python",
    ".js": "javascript",
    ".mjs": "javascript",
    ".ts": "typescript",
    ".json": "json",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".sh": "shell",
    ".xml": "xml",
  };
  if (n === ".env" || n.startsWith(".env.")) return "ini";
  return map[ext] || "plaintext";
};
const LANG_NAMES = {
  php: "PHP",
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  sql: "SQL",
  json: "JSON",
  markdown: "Markdown",
  plaintext: "Plain Text",
  ini: "Env/INI",
  yaml: "YAML",
  shell: "Shell",
  xml: "XML",
};
CF.langLabel = (p) => {
  const n = base(p).toLowerCase();
  if (n.endsWith(".vue")) return "Vue";
  if (n.endsWith(".blade.php")) return "Blade";
  if (/\.[jt]sx$/.test(n))
    return n.endsWith("x") && n.includes(".t") ? "TSX" : "JSX";
  return LANG_NAMES[CF.langFor(p)] || "Plain Text";
};

// ---- editor groups & tabs -----------------------------------------------------------
const S = CF.S;
function makeGroup() {
  const tabsEl = h("div", { class: "tabs" });
  const host = h("div", { class: "editor-host" });
  const el = h("div", { class: "group" }, tabsEl, host);
  const g = { el, tabsEl, host, tabs: [], active: null, pinned: new Set() };
  g.page = h("div", { class: "page", hidden: true });   // non-file tabs (e.g. extension details) render here, over the editor
  host.append(g.page);
  g.editor = monaco.editor.create(host, { model: null, ...CF.editorOptions() });
  g.editor.onDidChangeCursorPosition((e) => {
    if (S.groups[S.active] === g)
      $("#sb-pos").textContent =
        `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
  });
  g.editor.onDidFocusEditorText(() => {
    S.active = S.groups.indexOf(g);
    CF.updateStatus();
    if (g.active && CF.revealInTree) CF.revealInTree(g.active);
  });
  g.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
    CF.save(),
  );
  g.editor.onDidBlurEditorText(() => {
    if (S.settings.autoSave === "onFocusChange") CF.saveAll();
  });
  host.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        CF.fontStep(e.deltaY < 0 ? 1 : -1);
      }
    },
    { passive: false, capture: true },
  );
  S.groups.push(g);
  $("#groups").append(el);
  return g;
}
CF.initEditors = () => makeGroup();
CF.activeGroup = () => S.groups[S.active] || S.groups[0];
CF.split = (vertical) => {
  const g0 = CF.activeGroup();
  S.vertical = !!vertical;
  $("#groups").classList.toggle("vertical", !!vertical);
  if (S.groups.length < 2) {
    const g = makeGroup();
    if (g0.active) CF.openFile(g0.active, { group: g });
    S.active = S.groups.indexOf(g);
  } else {
    $("#groups").classList.toggle("vertical", !!vertical);
  }
  S.groups.forEach((g) => g.editor.layout());
};
CF.closeGroupIfEmpty = (g) => {
  if (S.groups.length > 1 && !g.tabs.length) {
    g.editor.dispose();
    g.el.remove();
    S.groups.splice(S.groups.indexOf(g), 1);
    S.active = 0;
    S.groups.forEach((x) => x.editor.layout());
  }
};

// Virtual tabs ("ext://<id>") have no Monaco model; they draw into g.page via CF.renderPage (ui.js).
// Each scheme registers { icon, title(path), render(group) } in CF.pages (ext:// in ui.js, kbd:// in keybindings.js).
CF.pages = {};
CF.isPage = (p) => /^(ext|kbd|settings):\/\//.test(p || "");
const pageOf = (p) => CF.pages[String(p).split(":")[0]];
CF.renderPage = (g) => {
  const pg = pageOf(g.active);
  return pg && pg.render(g);
};
CF.showActive = (g) => {
  const pg = CF.isPage(g.active);
  g.page.hidden = !pg;
  if (pg) return CF.renderPage(g);
  const m = g.active && S.models.get(g.active);
  g.editor.setModel(m ? m.model : null);
};
CF.openFile = CF.guard(async (path, { group, line, col } = {}) => {
  const g = group || CF.activeGroup();
  if (CF.isPage(path)) {
    if (!g.tabs.includes(path)) g.tabs.push(path);
    g.active = path;
    S.active = S.groups.indexOf(g);
    $("#welcome").hidden = true;
    CF.showActive(g);
    CF.renderTabs();
    CF.updateStatus();
    return;
  }
  let m = S.models.get(path);
  if (!m) {
    const r = await cf.fs.read(path);
    const model = monaco.editor.createModel(
      r.text,
      CF.langFor(path),
      monaco.Uri.file(path),
    );
    m = { path, model, saved: r.text, dirty: false, eol: r.eol };
    model.onDidChangeContent(() => {
      const d = model.getValue() !== m.saved;
      if (d !== m.dirty) {
        m.dirty = d;
        CF.renderTabs();
      }
      if (d && S.settings.autoSave === "afterDelay") {
        clearTimeout(m.timer);
        m.timer = setTimeout(() => CF.save(path), S.settings.autoSaveDelay);
      }
      CF.updateProblems();
    });
    S.models.set(path, m);
    CF.suggestExtension(path);
  }
  if (!g.tabs.includes(path)) g.tabs.push(path);
  g.active = path;
  g.page.hidden = true;
  g.editor.setModel(m.model);
  $("#welcome").hidden = true;
  if (line) {
    g.editor.revealLineInCenter(line);
    g.editor.setPosition({ lineNumber: line, column: col || 1 });
  }
  g.editor.focus();
  S.active = S.groups.indexOf(g);
  CF.renderTabs();
  CF.updateStatus();
  CF.revealInTree && CF.revealInTree(path);
});
CF.renderTabs = () =>
  S.groups.forEach((g) => {
    g.tabsEl.innerHTML = "";
    const ordered = [
      ...g.tabs.filter((p) => g.pinned.has(p)),
      ...g.tabs.filter((p) => !g.pinned.has(p)),
    ];
    ordered.forEach((p) => {
      const m = S.models.get(p);
      const t = h(
        "div",
        {
          class:
            "tab" +
            (p === g.active ? " active" : "") +
            (m && m.dirty ? " dirty" : "") +
            (g.pinned.has(p) ? " pinned" : ""),
          draggable: "true",
          title: CF.isPage(p) ? CF.pageTitle(p) : p,
          onclick: () => CF.openFile(p, { group: g }),
          onauxclick: (e) => {
            if (e.button === 1) CF.closeTab(g, p);
          },
          oncontextmenu: (e) => {
            e.preventDefault();
            CF.menu(e, [
              ["Close", () => CF.closeTab(g, p)],
              [
                "Close Others",
                () =>
                  g.tabs
                    .filter((x) => x !== p)
                    .forEach((x) => CF.closeTab(g, x)),
              ],
              ["Close Saved", () => CF.closeSaved(g)],
              [
                "Close All",
                () => [...g.tabs].forEach((x) => CF.closeTab(g, x)),
              ],
              "-",
              [
                g.pinned.has(p) ? "Unpin" : "Pin",
                () => {
                  g.pinned.has(p) ? g.pinned.delete(p) : g.pinned.add(p);
                  CF.renderTabs();
                },
              ],
              "-",
              [
                "Split Right",
                () => {
                  CF.split(false);
                  CF.openFile(p, { group: S.groups[1] });
                },
              ],
              [
                "Split Down",
                () => {
                  CF.split(true);
                  CF.openFile(p, { group: S.groups[1] });
                },
              ],
              [
                "Move to Other Group",
                () => {
                  const o = S.groups.find((x) => x !== g);
                  if (o) {
                    CF.closeTab(g, p, true);
                    CF.openFile(p, { group: o });
                  }
                },
              ],
              ...(CF.isPage(p)
                ? []
                : [
                    "-",
                    ["Copy Path", () => navigator.clipboard.writeText(p)],
                    ["Reveal in File Manager", () => cf.fs.reveal(p)],
                  ]),
            ]);
          },
          ondragstart: (e) =>
            e.dataTransfer.setData(
              "text/cf-tab",
              JSON.stringify({ p, gi: S.groups.indexOf(g) }),
            ),
          ondragover: (e) => {
            e.preventDefault();
            t.classList.add("drop");
          },
          ondragleave: () => t.classList.remove("drop"),
          ondrop: (e) => {
            e.preventDefault();
            t.classList.remove("drop");
            try {
              const d = JSON.parse(e.dataTransfer.getData("text/cf-tab"));
              const src = S.groups[d.gi];
              if (src === g) {
                g.tabs.splice(g.tabs.indexOf(d.p), 1);
                g.tabs.splice(g.tabs.indexOf(p), 0, d.p);
                CF.renderTabs();
              } else {
                CF.closeTab(src, d.p, true);
                CF.openFile(d.p, { group: g });
              }
            } catch {
              /* ignore */
            }
          },
        },
        h("span", {
          class: "ic",
          html: CF.isPage(p)
            ? CF.iconHtml((pageOf(p) || {}).icon || "extensions", 15)
            : CF.fileIconHtml(base(p), false),
        }),
        h("span", { class: "name" }, CF.isPage(p) ? CF.pageTitle(p) : base(p)),
        h(
          "span",
          {
            class: "x",
            onclick: (e) => {
              e.stopPropagation();
              CF.closeTab(g, p);
            },
          },
          h("span", {}, "✕"),
        ),
      );
      g.tabsEl.append(t);
    });
    if (ordered.length)
      g.tabsEl.append(
        h(
          "span",
          { class: "tabs-acts" },
          /\.(md|markdown|mdx|html?|svg)$/i.test(g.active || "")
            ? h(
                "button",
                {
                  class: "icon-btn" + (CF.mdOpen && CF.mdOpen() ? " on" : ""),
                  title: "Preview (Ctrl+Shift+V)",
                  onclick: () => CF.toggleMdPreview(),
                },
                CF.icon("eye", 15),
              )
            : null,
          h(
            "button",
            {
              class: "icon-btn",
              title: "Close Saved",
              onclick: () => CF.closeSaved(g),
            },
            "Close Saved",
          ),
          h(
            "button",
            {
              class: "icon-btn",
              title: "Close All",
              onclick: () => [...g.tabs].forEach((x) => CF.closeTab(g, x)),
            },
            "Close All",
          ),
        ),
      );
  });
CF.closeTab = CF.guard(async (g, p, force) => {
  const m = S.models.get(p);
  if (!force && m && m.dirty) {
    const ok = await CF.confirm(
      `"${base(p)}" has unsaved changes. Discard them?`,
      "Discard",
    );
    if (!ok) return;
  }
  g.tabs = g.tabs.filter((x) => x !== p);
  g.pinned.delete(p);
  if (g.active === p) {
    g.active = g.tabs[g.tabs.length - 1] || null;
    CF.showActive(g);
  }
  if (!S.groups.some((x) => x.tabs.includes(p)) && m) {
    clearTimeout(m.timer);
    m.model.dispose();
    S.models.delete(p);
  }
  CF.renderTabs();
  CF.closeGroupIfEmpty(g);
  CF.updateStatus();
  CF.updateProblems();
  {
    const ag = CF.activeGroup();
    if (ag && ag.active && !CF.isPage(ag.active) && CF.revealInTree)
      CF.revealInTree(ag.active);
  }
  if (S.root && S.groups.every((x) => !x.tabs.length) && !S.root)
    $("#welcome").hidden = false;
});
CF.save = CF.guard(async (path) => {
  const g = CF.activeGroup();
  path = path || g.active;
  const m = path && S.models.get(path);
  if (!m || !m.dirty) return;
  if (!/\.(md|markdown)$/i.test(path)) {
    // optional save-time clean-up (kept off for Markdown, where trailing double-space is a line break)
    const edits = [];
    if (S.settings.trimWhitespace)
      for (let i = 1, n = m.model.getLineCount(); i <= n; i++) {
        const c = m.model.getLineMaxColumn(i),
          t = m.model.getLineContent(i).replace(/\s+$/, "").length + 1;
        if (t < c)
          edits.push({ range: new monaco.Range(i, t, i, c), text: "" });
      }
    if (S.settings.finalNewline) {
      const n = m.model.getLineCount(),
        c = m.model.getLineMaxColumn(n);
      if (c > 1)
        edits.push({ range: new monaco.Range(n, c, n, c), text: "\n" });
    }
    if (edits.length) m.model.pushEditOperations([], edits, () => null);
  }
  const text = m.model.getValue();
  await cf.fs.write(path, text);
  m.saved = text;
  m.dirty = false;
  CF.renderTabs();
  if (path === S.keyboardFile) {
    // hand-edited keyboard.json: re-read it so the shortcuts change immediately
    await CF.loadKeys();
    CF.toast("Keyboard shortcuts reloaded");
  }
  if (path === S.settingsFile) {
    // hand-edited settings.json: re-read it and reload extensions
    try {
      JSON.parse(text);
    } catch (e) {
      return CF.toast("settings.json is not valid JSON: " + e.message, true);
    }
    S.settings = await cf.settings.get();
    await CF.loadExtensions(true);
    CF.applySettings();
    CF.toast("settings.json applied");
  }
  CF.gitRefresh && CF.gitRefresh();
});
CF.saveAll = () => [...S.models.keys()].forEach((p) => CF.save(p));
CF.pageTitle = (p) => {
  const pg = pageOf(p);
  return pg ? pg.title(p) : p;
};
CF.updateStatus = () => {
  const g = CF.activeGroup();
  const m = g && g.active && S.models.get(g.active);
  $("#sb-lang").innerHTML = m ? CF.fileIconHtml(base(m.path), false) : "";
  $("#sb-lang").append(m ? CF.langLabel(m.path) : "—");
  $("#sb-eol").textContent = m ? m.eol : "LF";
  {
    const md = $("#sb-md");
    if (md) md.hidden = !(m && /\.(md|markdown|mdx|html?|svg)$/i.test(m.path));
  }
  if (!m) $("#sb-pos").textContent = "";
};
CF.reloadOpenFiles = CF.guard(async () => {
  for (const m of S.models.values())
    if (!m.dirty) {
      try {
        const r = await cf.fs.read(m.path);
        if (r.text !== m.saved) {
          m.saved = r.text;
          m.model.setValue(r.text);
        }
      } catch {
        /* deleted */
      }
    }
});
CF.closeSaved = (g) =>
  [...g.tabs].forEach((p) => {
    const m = S.models.get(p);
    if (!m || !m.dirty) CF.closeTab(g, p, true);
  });
CF.closeAllEditors = () => {
  S.groups.forEach((g) => [...g.tabs].forEach((p) => CF.closeTab(g, p, true)));
};

// ---- context menu ---------------------------------------------------------------------
CF.menu = (e, items) => {
  const m = $("#ctx");
  m.innerHTML = "";
  m.hidden = false;
  items.forEach((it) =>
    m.append(
      it === "-"
        ? h("hr")
        : h(
            "div",
            {
              onclick: () => {
                m.hidden = true;
                it[1]();
              },
            },
            it[0],
          ),
    ),
  );
  m.style.left = Math.min(e.clientX, innerWidth - 220) + "px";
  m.style.top =
    Math.min(e.clientY, innerHeight - items.length * 28 - 10) + "px";
};
document.addEventListener("mousedown", (e) => {
  if (!e.target.closest("#ctx")) $("#ctx").hidden = true;
});

// ---- problems -----------------------------------------------------------------------------
CF.updateProblems = () => {
  if (!window.monaco) return;
  const ms = monaco.editor.getModelMarkers({});
  const sev = monaco.MarkerSeverity;
  const e = ms.filter((x) => x.severity === sev.Error),
    w = ms.filter((x) => x.severity === sev.Warning);
  $("#sb-problems").textContent = `⊗ ${e.length}  ⚠ ${w.length}`;
  $("#prob-count").textContent = ms.length ? `(${ms.length})` : "";
  const box = $("#panel-problems");
  box.innerHTML = "";
  if (!ms.length)
    box.append(
      h(
        "div",
        { class: "muted" },
        "No problems detected. (Built-in diagnostics cover JS/TS/JSON/CSS/HTML; PHP and Python need a language server extension.)",
      ),
    );
  ms.slice(0, 500).forEach((x) =>
    box.append(
      h(
        "div",
        {
          class: "prob",
          onclick: () =>
            CF.openFile(x.resource.fsPath, {
              line: x.startLineNumber,
              col: x.startColumn,
            }),
        },
        h(
          "span",
          {
            class:
              x.severity === sev.Error
                ? "e"
                : x.severity === sev.Warning
                  ? "w"
                  : "i",
          },
          x.severity === sev.Error
            ? "⊗"
            : x.severity === sev.Warning
              ? "⚠"
              : "ⓘ",
        ),
        h("span", {}, x.message),
        h("small", {}, `${rel(x.resource.fsPath)}:${x.startLineNumber}`),
      ),
    ),
  );
};
