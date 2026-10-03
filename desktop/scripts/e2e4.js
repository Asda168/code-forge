(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = (await cf.ws.recents())[0].path; await CF.setRoot(root); await sleep(800);
  document.querySelector('[data-view=extensions]').click(); await sleep(1000);
  const icons = [...document.querySelectorAll('#side-body .ext-ic')].map((e) => e.textContent + ':' + e.style.background);
  const installs = [...document.querySelectorAll('#side-body button')].filter((b) => b.textContent === 'Install').length;
  return { iconCount: icons.length, sample: icons.slice(0, 4), installButtons: installs };
})()
