# Source Control panel: layout spec and design tokens

The panel is built in `desktop/src/renderer/git.js` (markup) and the trailing `Source Control` blocks of
`desktop/src/renderer/styles.css` (tokens + components). Everything is scoped under `.scm`, so it cannot leak into other views.
Light themes automatically switch to the theme's own surface colours (`.scm-light`).

## Layout (top to bottom, 280px reference width)

```
SOURCE CONTROL                                  ⟳  ⋯          panel header (title + refresh, more)
┌ main ┐                              [+ New Branch]          meta row: branch pill, ↑↓ chips, branch action
┌─ ⚠ 2 merge conflicts ─────────────────────[Resolve]┐        conflict banner (only when conflicts exist)
│  Resolve and stage each file, then commit.         │
└────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────┐        commit field (auto-grows to 220px)
│ Message (Ctrl+Enter to commit…)        ( ✦ Generate )│
└────────────────────────────────────────────────────┘
[ ✓ Commit 3                     Ctrl ↵ │ ⌄ ]                    split button, shortcut chip INSIDE
▾ CHANGES  4                    ✦ ⟳ ⎇ + ↶                     section header + tool strip
  MERGE CHANGES 2 | STAGED 3 | UNSTAGED 4                      groups
    ▾ src                                         3            folder rows (compact single-child chains)
        Button.js                                 M            file rows: 16px icon · name · (actions) · 18px badge
▸ BRANCHES 2   ▸ COMMITS 3   ▸ REMOTES 0                       secondary sections start collapsed
```

### Component breakdown
| Component | Class | Notes |
|---|---|---|
| Panel header | `#side-title` + `.scm-acts` | Refresh and a "more" menu (Pull, Push, Fetch, Sync, Stash, New branch) |
| Meta row | `.scm-meta`, `.scm-branch`, `.scm-chip`, `.scm-newbranch` | Neutral pill, accent icon; ahead/behind chips |
| Conflict banner | `.scm-banner` | The **only** conflict surface. Title, one-line hint, one primary action (Resolve) |
| Commit field | `.scm-field`, `.scm-gen` | Embedded Generate pill, focus ring uses `--scm-glow` |
| Split button | `.scm-split`, `.scm-commit`, `.scm-chev`, `.k` | Becomes Sync Changes / Publish Branch automatically; disabled (`.off`) while conflicts exist |
| Section header | `.scm-sec`, `.sec-head` | One style for Changes, Branches, Commits, Remotes: 34px, 18px chevron box, neutral count pill |
| Group label | `.scm-group` | Merge Changes (amber), Staged, Unstaged |
| File / folder row | `.scm-file`, `.scm-dir`, `.scm-conflict` | 28px rows, 12px outer padding, 8px gaps, hover actions, context menu, keyboard access |
| Status badge | `.st` + `M A D U R X` | 18px square; `X` (conflict) is the only solid badge |
| Commit row | `.scm-cm` | Graph rail + hollow dot (HEAD filled), mono hash, ref chip, one-line subject |
| Empty state | `.scm-emptycard` | Dashed card with a primary action (Add remote) |

### Behaviour rules
1. **One call to action per state.** Conflicts: banner "Resolve". Changes: "Commit". Clean and ahead/behind: "Sync Changes". No upstream: "Publish Branch".
2. The commit button is disabled (never hidden) while conflicts exist; its tooltip says why, and the chevron still offers *Abort merge*.
3. The shortcut hint is a chip **inside** the button, so a narrow sidebar can never clip it.
4. Secondary sections (Branches, Commits, Remotes) start collapsed; their state persists per session.
5. Status colour is information, not decoration: amber = modified / needs attention, green = added, red = deleted, accent = everything interactive.

## Design tokens

### CSS (as shipped)
```css
.scm {
  /* neutrals (zinc) */
  --scm-bg:#121316; --scm-s1:#17181c; --scm-s2:#1d1f24;
  --scm-line:#ffffff0f; --scm-line2:#ffffff1a; --scm-hover:#ffffff0a;
  --scm-fg:#e6e8ec; --scm-mut:#9aa1ad; --scm-dim:#6b7280;
  /* one accent for all interactive controls */
  --scm-accent:#6d70f2; --scm-accent-hi:#7d80f5; --scm-accent-soft:#6d70f21f; --scm-accent-line:#6d70f259; --scm-accent-text:#a1a4f8; --scm-glow:#6d70f240;
  /* restrained status colours */
  --scm-warn:#e5b64e; --scm-warn-soft:#e5b64e14; --scm-warn-line:#e5b64e47; --scm-ok:#5fd08a; --scm-bad:#f0716f;
  /* shape + rhythm */
  --scm-r:8px; --scm-r-sm:6px; --scm-r-pill:999px; --scm-row:28px; --scm-pad:12px; --scm-gap:8px;
}
```

### Typography
| Role | Font | Size / weight |
|---|---|---|
| Body, file names, commit subject | Inter, Segoe UI, system-ui | 12.5px / 400 |
| Section and group labels | Inter | 10.5px / 700, uppercase, +0.07em |
| Counts, hashes, shortcuts, refs | JetBrains Mono | 10-11px / 500-600, tabular numbers |
| Primary button | Inter | 12.5px / 600 |

### Spacing and radius
Base unit 4px; row height 28px; panel gutter 12px; control gap 8px; radius 8px (cards, field, buttons), 6px (small buttons, chips), 999px (pills, counts).

### Tailwind equivalent
```js
// tailwind.config.js (theme.extend)
colors: {
  scm: {
    bg: '#121316', s1: '#17181c', s2: '#1d1f24',
    fg: '#e6e8ec', mut: '#9aa1ad', dim: '#6b7280',
    accent: '#6d70f2', 'accent-hi': '#7d80f5', 'accent-text': '#a1a4f8',
    warn: '#e5b64e', ok: '#5fd08a', bad: '#f0716f',
  },
},
borderColor: { scm: 'rgb(255 255 255 / 0.06)', 'scm-strong': 'rgb(255 255 255 / 0.10)' },
borderRadius: { scm: '8px', 'scm-sm': '6px' },
spacing: { 'scm-row': '28px', 'scm-pad': '12px' },
fontFamily: { ui: ['Inter', 'Segoe UI', 'system-ui'], mono: ['JetBrains Mono', 'monospace'] },
```

## Accessibility
Rows and section headers are focusable (`tabindex`), Enter opens, the Menu key / Shift+F10 opens the options menu, controls have
`aria-label`s, focus rings use the accent, and `prefers-reduced-motion` disables the panel transitions.
