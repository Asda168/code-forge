// Keyboard shortcuts (Antigravity / VS Code style) and the shortcut reference dialog.
(() => {
  const { S, $, h } = CF;
  const LIST = [
    ['General', [['Command Palette', 'Ctrl+Shift+P'], ['Quick Open', 'Ctrl+P'], ['Settings', 'Ctrl+,'], ['Keyboard Shortcuts', 'Ctrl+K Ctrl+S'], ['Color Theme', 'Ctrl+K Ctrl+T']]],
    ['Views', [['Explorer', 'Ctrl+Shift+E'], ['Search', 'Ctrl+Shift+F'], ['Source Control', 'Ctrl+Shift+G'], ['Run and Debug', 'Ctrl+Shift+D'], ['Extensions', 'Ctrl+Shift+X'], ['GitLens', 'Alt+G'], ['Toggle Sidebar', 'Ctrl+B']]],
    ['Panel & Terminal', [['Toggle Panel', 'Ctrl+J'], ['Toggle Terminal', 'Ctrl+`'], ['New Terminal', 'Ctrl+Shift+`'], ['Split Terminal', 'Ctrl+Shift+5'], ['Kill Terminal', 'Ctrl+Shift+W (in terminal)'], ['Clear Terminal', 'Ctrl+Shift+K'],
      ['Next / Previous Terminal', 'Ctrl+PageDown / PageUp'], ['Focus Next / Previous Pane', 'Alt+Right / Alt+Left'], ['Copy / Paste', 'Ctrl+Shift+C / V'], ['Problems', 'Ctrl+Shift+M'], ['Debug Console', 'Ctrl+Shift+Y']]],
    ['Run', [['Run', 'F5'], ['Stop', 'Shift+F5'], ['Restart', 'Ctrl+Shift+F5']]],
    ['Editor', [['Save', 'Ctrl+S'], ['Save All', 'Ctrl+Alt+S'], ['Close Editor', 'Ctrl+W'], ['Next / Previous Editor', 'Ctrl+Tab / Ctrl+Shift+Tab'], ['Split Editor', 'Ctrl+\\'], ['Go to Line', 'Ctrl+G'], ['Go to Definition', 'F12']]],
    ['GitLens', [['Toggle Line Blame', 'Alt+B'], ['Toggle File Blame', 'Alt+Shift+B'], ['File History', 'Alt+H'], ['Line History', 'Alt+Shift+H']]],
  ];
  CF.shortcutsDialog = () => CF.modal('Keyboard Shortcuts', LIST.map(([t, items]) => h('div', {}, h('h4', { style: 'margin:14px 0 6px' }, t),
    ...items.map(([a, k]) => h('div', { class: 'sc-row' }, h('span', {}, a), h('span', { class: 'grow' }), k.split(' / ').map((x) => h('kbd', {}, x)))))), [{ label: 'Close' }], { wide: true });

  let chord = 0;
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey && e.code === 'KeyK') { chord = Date.now(); return; }
    if (chord && Date.now() - chord < 1500 && mod && e.code === 'KeyS') { e.preventDefault(); e.stopPropagation(); chord = 0; CF.shortcutsDialog(); return; }
    if (!mod || e.altKey) return;
    const inTerm = !!(e.target.closest && e.target.closest('.xterm'));
    if (!e.shiftKey && e.code === 'KeyJ') { e.preventDefault(); CF.togglePanel(); }
    else if (e.shiftKey && e.code === 'KeyD') { e.preventDefault(); CF.showView('run'); }
    else if (e.shiftKey && e.code === 'KeyM') { e.preventDefault(); CF.showPanel('problems'); }
    else if (e.shiftKey && (e.code === 'KeyY' || e.code === 'KeyU')) { e.preventDefault(); CF.showPanel('debug'); }
    else if (e.shiftKey && e.code === 'Digit5' && !inTerm) { e.preventDefault(); CF.splitTerminal(); }
  }, true);
  document.addEventListener('keydown', (e) => { if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyG') { e.preventDefault(); CF.showView('gitlens'); } }, true);

  // dropping a file anywhere outside a drop target must not navigate the window
  ['dragover', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));
})();
