const { contextBridge, ipcRenderer, webUtils } = require('electron');

const inv = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
const on = (ch, fn) => { const h = (_e, ...a) => fn(...a); ipcRenderer.on(ch, h); return () => ipcRenderer.removeListener(ch, h); };

contextBridge.exposeInMainWorld('cf', {
  pathFor: (file) => webUtils.getPathForFile(file),
  ws: { openDialog: inv('ws:openDialog'), recents: inv('ws:recents'), openRecent: inv('ws:openRecent'), pickDir: inv('ws:pickDir'),
        save: inv('ws:saveWorkspace'), list: inv('ws:listWorkspaces'), load: inv('ws:loadWorkspace') },
  fs: { list: inv('fs:list'), read: inv('fs:read'), write: inv('fs:write'), createFile: inv('fs:createFile'), mkdir: inv('fs:mkdir'),
        rename: inv('fs:rename'), move: inv('fs:move'), copy: inv('fs:copy'), delete: inv('fs:delete'), reveal: inv('fs:reveal'),
        search: inv('fs:search'), files: inv('fs:files'), watch: inv('fs:watch'), replaceInFile: inv('fs:replaceInFile') },
  term: { shells: inv('term:shells'), detectGitBash: inv('term:detectGitBash'), create: inv('term:create'),
          write: (id, d) => ipcRenderer.send('term:write', id, d), resize: (id, c, r) => ipcRenderer.send('term:resize', id, c, r),
          kill: (id) => ipcRenderer.send('term:kill', id),
          onData: (fn) => on('term:data', fn), onExit: (fn) => on('term:exit', fn) },
  git: { run: inv('git:run'), clone: inv('git:clone'), detect: inv('git:detect') },
  project: { detect: inv('project:detect'), confirmDangerous: inv('project:confirmDangerous'), scaffold: inv('project:scaffold'), openRoot: inv('project:openRoot') },
  settings: { get: inv('settings:get'), set: inv('settings:set'), file: inv('settings:file') },
  keys: { get: inv('keys:get'), set: inv('keys:set'), file: inv('keys:file') },
  ext: { pickThemeFile: inv('ext:pickThemeFile'), saveManifest: inv('ext:saveManifest'), catalog: inv('ext:catalog'), installBundled: inv('ext:installBundled'), list: inv('ext:list'), install: inv('ext:install'), uninstall: inv('ext:uninstall'), sync: inv('ext:sync') },
  api: { login: inv('api:login'), logout: inv('api:logout'), loggedIn: inv('api:loggedIn'), request: inv('api:request') },
  app: { checkUpdates: inv('app:checkUpdates'), openExternal: inv('app:openExternal'), platform: inv('app:platform') },
  app2: { forceClose: inv('app:forceClose') },
  win: { new: inv('win:new'), newPick: inv('win:newPick') },
  onFsChanged: (fn) => on('fs:changed', fn),
  onAskClose: (fn) => on('ask-close', fn),
  onMenu: (fn) => on('menu', fn),
  onOpenPath: (fn) => on('open-path', fn),
});
