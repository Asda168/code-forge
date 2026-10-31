Make AstaIDE comfortable for React, Vue, HTML and CSS work.

## Extensions

| Install | For |
|---|---|
| **React Snippets** | Components and hooks; `.jsx` / `.tsx` |
| **Vue Snippets** | Single-file components; `.vue` |
| **JavaScript Snippets** | JS and TS helpers |

## Settings

```json
{
  "tabSize": 2,
  "wordWrap": true,
  "minimap": false,
  "ligatures": true,
  "bracketColors": true,
  "autoSave": "afterDelay",
  "autoSaveDelay": 500
}
```

A shorter save delay makes hot-reload dev servers (Vite, webpack) update as you type.

## Preview files

Markdown, HTML and SVG files can be previewed: press <kbd>Ctrl+Shift+V</kbd> (Command Palette: **Toggle File Preview**).

## Layout for UI work

- <kbd>Ctrl+\</kbd> to split the editor: component on the left, styles on the right.
- <kbd>Ctrl+Alt+H</kbd> hides the header for more vertical space.
- <kbd>Ctrl+B</kbd> hides the sidebar when you want the code full width.

## Theme and fonts

A light theme such as *Paper* or *Light Modern* makes it easier to judge light-mode designs. Increase `lineHeight` to `1.6` for long JSX files.

## Run configuration

Detection gives you `npm run dev` for Vite, Vue CLI or Next-style projects. Add `npm run build` and `npm run preview` as extra configurations.

## Expected result

A split layout with the dev server in the terminal below and instant feedback in the browser.

## Related

- [Node.js, React and Vue Setup](../run-debug/node-react-vue.md)
- [Change the Color Theme](../themes/color-theme.md)
