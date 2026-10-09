// Shortcut handling lives in keybindings.js (registry, keyboard.json overrides, dispatcher, Keyboard Shortcuts tab).
(() => {
  // dropping a file anywhere outside a drop target must not navigate the window
  ['dragover', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));
})();
