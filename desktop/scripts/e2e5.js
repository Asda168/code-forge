(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = (await cf.ws.recents())[0].path; await CF.setRoot(root); await sleep(800);
  const res = {};
  for (const v of ['extensions', 'git', 'run', 'search']) {
    document.querySelector(`[data-view=${v}]`).click(); await sleep(900);
    const b = document.getElementById('side-body'); b.scrollTop = 99999;
    res[v] = { scrollHeight: b.scrollHeight, clientHeight: b.clientHeight, canScroll: b.scrollHeight > b.clientHeight, scrolledTo: b.scrollTop };
  }
  const b = document.getElementById('side-body'); document.querySelector('[data-view=extensions]').click(); await sleep(900);
  const last = [...document.querySelectorAll('#side-body .ext')].pop(); const lb = last.getBoundingClientRect();
  res.extLastRowReachable = lb.height > 30;
  return res;
})()
