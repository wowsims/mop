// Wrapped in parentheses so tsc (allowJs) parses it as an expression statement.
// Add a second [name, url] pair to A/B against another checkout.
(async (page) => {
  page.setDefaultTimeout(120000);
  const out = {};
  for (const [name, url] of [['this-branch', 'http://localhost:3333/mop/death_knight/unholy/']]) {
    await page.goto(url);
    await page.waitForSelector('.dps-action');
    await page.waitForTimeout(3000);
    await page.evaluate(() => { const l = [...document.querySelectorAll('.nav-link')].find(a => /^Rotation$/i.test((a.textContent || '').trim())); l && l.click(); });
    await page.waitForTimeout(1000);
    await page.evaluate(() => { const chips = [...document.querySelectorAll('.saved-data-set-name')].filter(e => e.textContent.trim() === 'Festerblight'); (chips.find(e => e.offsetParent) || chips[0])?.click(); });
    await page.waitForFunction(() => document.querySelectorAll('#rotation-tab .list-picker-item').length > 100);
    await page.waitForTimeout(5000);
    const counts = await page.evaluate(() => ({ items: document.querySelectorAll('#rotation-tab .list-picker-item').length, nodes: document.querySelectorAll('#rotation-tab *').length, numeric: [...document.querySelectorAll('#rotation-tab input')].filter(e => e.offsetParent && e.value !== '' && !isNaN(Number(e.value))).length }));
    const edits = [];
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        window.__m = { long: [], muts: 0, t0: performance.now(), last: performance.now() };
        window.__po = new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.long.push(Math.round(e.duration)); });
        window.__po.observe({ type: 'longtask' });
        window.__mo = new MutationObserver(ms => { window.__m.muts += ms.length; window.__m.last = performance.now(); });
        window.__mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
        const inp = [...document.querySelectorAll('#rotation-tab input')].find(e => e.offsetParent && e.value !== '' && !isNaN(Number(e.value)));
        window.__m.field = inp.className;
        const t = performance.now();
        inp.value = String(Number(inp.value) + 1);
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        window.__m.sync = Math.round(performance.now() - t);
      });
      await page.waitForFunction(() => performance.now() - window.__m.last > 1500);
      edits.push(await page.evaluate(() => { window.__po.disconnect(); window.__mo.disconnect(); return { sync: window.__m.sync, settle: Math.round(window.__m.last - window.__m.t0), muts: window.__m.muts, longTasks: window.__m.long, field: window.__m.field }; }));
    }
    out[name] = { counts, edits };
  }
  return JSON.stringify(out);
})
