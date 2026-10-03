(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = (await cf.ws.recents())[0].path; await CF.setRoot(root); await sleep(800);
  document.querySelector('[data-view=extensions]').click(); await sleep(800);
  const before = [...document.querySelectorAll('#side-body button')].filter((b) => b.textContent === 'Install').length;
  [...document.querySelectorAll('#side-body button')].find((b) => b.textContent === 'Install').click(); await sleep(1200);
  [...document.querySelectorAll('#side-body button')].find((b) => b.textContent === 'Install').click(); await sleep(1200);
  const installed = (await cf.ext.list()).map((e) => e.id);
  const prov = !!CF.S.extensions.length;
  const sn = installed.includes('php') || installed.includes('laravel');
  for (const id of installed) await cf.ext.uninstall(id);
  return { installButtonsBefore: before, installed, loadedInUI: prov, ok: sn };
})()
