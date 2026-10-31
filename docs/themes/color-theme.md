A colour theme changes the whole window: sidebar, editor, terminal and panels.

## Change the color theme

1. Press <kbd>Ctrl+K</kbd> then <kbd>Ctrl+T</kbd> (or Command Palette, **Preferences: Color Theme**).
2. Pick one with the mouse or the arrow keys and <kbd>Enter</kbd>.
3. The theme applies at once and is remembered.

You can also use Settings, **Theme**, *Color theme*, or `settings.json`:

```json
{ "theme": "monokai-dimmed" }
```

The default is **Monokai Dimmed** (`monokai-dimmed`). To restore it, set that value or delete the `theme` key.

## Built-in themes

| Theme | Light or dark |
|---|---|
| Asta Dark (`codeforge-dark`), Asta Light (`codeforge-light`), High Contrast (`high-contrast`) | Dark, light, high contrast |
| Midnight, Vampire (Dracula-inspired), Solar (Solarized-inspired) | Dark |
| Dark Modern, Dark+, Monokai, Monokai Dimmed, Solarized Dark, Abyss, Kimbie Dark, Tomorrow Night Blue, Red, JetBrains Darcula (PhpStorm) | Dark |
| Light Modern, Light+, Solarized Light, Quiet Light | Light |

## Extension themes

Five more themes come as bundled extensions. Install one from the Extensions view (<kbd>Ctrl+Shift+X</kbd>), then pick it in the Color Theme list.

### Forest Theme

A calm green dark theme. Accent `#4ade80` on a deep green background. Theme id: `theme-forest.forest`.

### Neon Night Theme

High-energy purple and cyan on a dark background. Install **Neon Night Theme**.

### Ocean Theme

A deep teal dark theme. Install **Ocean Theme**.

### Paper Theme

A soft light theme for daytime. Install **Paper Theme**.

### Sunset Theme

A warm dark theme with rose accents. Install **Sunset Theme**.

```json
{ "theme": "theme-forest.forest" }
```

Use the **Color Theme** picker to see the exact id of each installed theme.

## Bring your own

- **Import VS Code theme:** Command Palette, **Preferences: Import VS Code Theme…**.
- **Write one:** [Theme Extensions](../extensions/themes.md).

## Expected result

The change is immediate, with no restart. Your choice is remembered.

## Common problems

- **A theme is missing from the list:** its extension is not installed or is disabled.
- **The terminal colours look off:** the terminal uses the theme's colours; reselect the theme if it was changed while a terminal was open.

## Related

- [Editor Colors and Fonts](editor-appearance.md)
- [Sidebar, Terminal and Layout Appearance](layout.md)
