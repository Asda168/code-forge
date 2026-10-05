import json, pathlib, re
cat = pathlib.Path(r'D:\CodeForge\desktop\src\catalog')
ICONS = {
    'php': ('🐘', '#777bb3'), 'laravel': ('🅻', '#ff2d20'), 'python': ('🐍', '#3776ab'), 'django': ('🎸', '#092e20'),
    'javascript': ('JS', '#f7df1e'), 'vue': ('V', '#42b883'), 'react': ('⚛', '#61dafb'), 'sql': ('🛢', '#00758f'),
    'mysql': ('🐬', '#00618a'), 'git': ('⑂', '#f05032'), 'theme-ocean': ('🌊', '#06b6d4'), 'theme-sunset': ('🌇', '#fb7185'),
}
for f in cat.glob('*.json'):
    m = json.loads(f.read_text(encoding='utf8'))
    if m['id'] in ICONS:
        m['icon'], m['color'] = ICONS[m['id']]
    f.write_text(json.dumps(m, indent=2, ensure_ascii=False), encoding='utf8')


def theme(id, name, desc, icon, color, base, ui, ed):
    m = {"id": id, "name": name, "version": "1.0.0", "description": desc, "icon": icon, "color": color,
         "themes": [{"id": id.replace('theme-', ''), "name": name.replace(' Theme', ''), "base": base, "ui": ui, "ed": ed}]}
    (cat / f'{id}.json').write_text(json.dumps(m, indent=2, ensure_ascii=False), encoding='utf8')


theme('theme-forest', 'Forest Theme', 'Calm green dark theme', '🌲', '#22c55e', 'vs-dark',
      {"--bg": "#0d1a14", "--side": "#10231a", "--panel": "#0e1d16", "--border": "#1a3a2a", "--hover": "#17332a", "--sel": "#1f4a37", "--accent": "#4ade80", "--cyan": "#86efac"},
      {"editor.background": "#0d1a14", "editor.lineHighlightBackground": "#12281d"})
theme('theme-paper', 'Paper Theme', 'Soft light theme for daytime', '📄', '#a8a29e', 'vs',
      {"--bg": "#faf8f4", "--side": "#f0ece3", "--panel": "#f5f1e8", "--fg": "#2b2a27", "--mut": "#7a756b", "--border": "#ddd6c7", "--hover": "#e8e2d3", "--sel": "#d9d1bd", "--accent": "#b45309"},
      {"editor.background": "#faf8f4"})
theme('theme-neon', 'Neon Night Theme', 'High-energy purple and cyan', '🌃', '#a855f7', 'vs-dark',
      {"--bg": "#0a0614", "--side": "#100a20", "--panel": "#0c0818", "--border": "#271a4a", "--hover": "#1d1236", "--sel": "#33205f", "--accent": "#a855f7", "--cyan": "#22d3ee"},
      {"editor.background": "#0a0614", "editor.lineHighlightBackground": "#150d2b"})

# one combined file for the website (Vercel deploys only backend/)
items = []
for f in sorted(cat.glob('*.json')):
    m = json.loads(f.read_text(encoding='utf8'))
    kinds = []
    if m.get('snippets'): kinds.append('Snippets')
    if m.get('themes'): kinds.append('Theme')
    if m.get('fileAssociations'): kinds.append('File types')
    if m.get('navigation'): kinds.append('Go to definition')
    n = sum(len(v) for v in m.get('snippets', {}).values())
    items.append({"id": m['id'], "name": m['name'], "description": m['description'], "icon": m.get('icon', '🧩'), "color": m.get('color', '#8b5cf6'),
                  "kinds": kinds, "snippets": n, "themes": [t['name'] for t in m.get('themes', [])],
                  "sample": next(iter(next(iter(m['snippets'].values()))), None) if m.get('snippets') else None})
pathlib.Path(r'D:\CodeForge\backend\core\catalog.json').write_text(json.dumps(items, indent=1, ensure_ascii=False), encoding='utf8')
print(len(items), 'extensions')
