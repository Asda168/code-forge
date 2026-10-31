Any folder with a `package.json` is detected as Node, React or Vue and gets a run configuration from its npm scripts.

## Requirements

- Node.js and npm (`node -v`, `npm -v`).

## How the command is chosen

| `package.json` has | Detected as | Command |
|---|---|---|
| a `dev` script | `node` / `react` / `vue` | `npm run dev` |
| no `dev` but a `start` script | same | `npm start` |
| `vue` in dependencies | `vue` | (same rule) |
| `react` in dependencies | `react` | (same rule) |

The configuration is named after the type and script, for example `react (dev)`.

## Node.js development setup

```bash
npm init -y
npm install express
```

Add a script to `package.json`:

```json
{ "scripts": { "dev": "node server.js" } }
```

Press **Run**; AstaIDE runs `npm run dev`.

## React

Create a project with the New Project wizard (type **react**) or:

```bash
npm create vite@latest my-react-app -- --template react
cd my-react-app
npm install
```

Run uses `npm run dev` (Vite serves at http://localhost:5173). Install the **React Snippets** extension for components and hooks; `.jsx` and `.tsx` files are associated automatically.

## Vue

```bash
npm create vue@latest my-vue-app
cd my-vue-app
npm install
```

Run uses `npm run dev`. Install **Vue Snippets** for single-file components; `.vue` files are recognised.

## Debug

| Command | Debug version |
|---|---|
| `node server.js` | `node --inspect server.js` |
| `npm run dev` | `node --inspect-brk node_modules/.bin/dev #` |

> **Note:** the `npm run` form only works when the script name is also an executable in `node_modules/.bin` (for example a script called `vite`). For other scripts, create a run configuration whose command is `node server.js` and use **Debug** on that.

Attach any Node inspector client (for example Chrome's `chrome://inspect`) to the port Node prints. AstaIDE itself does not include a graphical Node debugger.

## Expected result

The dev server prints its local URL, and saving a file triggers a reload.

## Common problems

- **"missing script: dev":** add a `dev` or `start` script to `package.json`.
- **Port already in use:** stop the earlier run or pass a port, for example `npm run dev -- --port 5174`.
- **`npm` not found:** [Node.js Not Found](../troubleshooting/runtimes.md#node-js-not-found).

## Related

- [Customize AstaIDE for Node.js](../advanced-guides/nodejs.md)
- [Customize AstaIDE for Frontend Development](../advanced-guides/frontend.md)
