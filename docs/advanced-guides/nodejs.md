Settings and run configurations for Node.js projects.

## Settings

Most Node projects use 2 spaces:

```json
{
  "tabSize": 2,
  "insertSpaces": true,
  "finalNewline": true,
  "trimWhitespace": true,
  "autoSave": "afterDelay",
  "autoSaveDelay": 800
}
```

If your project uses a formatter such as Prettier, run it from the terminal (`npx prettier --write .`); AstaIDE does not run formatters automatically.

## Extensions

Install **JavaScript Snippets** (JS and TypeScript helpers). For React or Vue also install their snippet extensions.

## Run configurations

AstaIDE picks `npm run dev` (or `npm start`) automatically. Add more in Run and Debug (**+**):

| Name | Command | Environment |
|---|---|---|
| API | `node server.js` | `NODE_ENV=development PORT=4000` |
| Tests | `npm test` | |
| Build | `npm run build` | `NODE_ENV=production` |

## Debugging

**Debug** on `node server.js` runs `node --inspect server.js`. Open `chrome://inspect` in Chrome and click *inspect* on the target, or use your preferred inspector client.

## Tips

- Open the folder that contains `package.json` so detection works.
- Search skips `node_modules` automatically.
- <kbd>Ctrl+Shift+5</kbd> splits the terminal so a server and a test watcher run side by side.

## Expected result

Run starts your dev script and the terminal shows its URL or log output.

## Related

- [Node.js, React and Vue Setup](../run-debug/node-react-vue.md)
- [Customize AstaIDE for Frontend Development](frontend.md)
