// Wrapped in parentheses so tsc (allowJs) parses it as an expression statement.
// Add a second [name, url] pair to A/B against another checkout.
(async (page) => {
  // Edit the host/spec before running (see README.md).
  const url = 'http://localhost:3333/mop/warrior/arms/';
  page.setDefaultTimeout(150000);
  await page.goto(url);
  await page.waitForSelector('.dps-action');
  await page.waitForTimeout(4000);
  const dpsSel = '.results-sim-dps .topline-result-avg';
  const t0 = Date.now();
  await page.click('.dps-action');
  await page.waitForSelector('.results-sim-set-reference');
  const sim1 = Date.now() - t0;
  const dps1 = await page.textContent(dpsSel);
  await page.click('.results-sim-set-reference');
  await page.waitForSelector('.results-sim-reference.has-reference');
  const t1 = Date.now();
  await page.click('.dps-action');
  await page.waitForFunction((d) => { const e = document.querySelector('.results-sim-dps .topline-result-avg'); return e && e.textContent !== d; }, dps1);
  const sim2 = Date.now() - t1;
  await page.evaluate(() => { const l = [...document.querySelectorAll('.nav-link')].find(a => /^Results$/i.test((a.textContent || '').trim())); l && l.click(); });
  await page.waitForTimeout(1500);
  const t2 = Date.now();
  await page.evaluate(() => { const l = [...document.querySelectorAll('.nav-link')].find(a => /^Timeline$/i.test((a.textContent || '').trim())); l && l.click(); });
  await page.waitForFunction(() => document.querySelectorAll('.rotation-timeline .rotation-timeline-row').length > 0);
  await page.waitForTimeout(2000);
  const tlOpen = Date.now() - t2;
  const swaps = [];
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => {
      window.__m = { long: [], muts: 0, t0: performance.now(), last: performance.now() };
      window.__po = new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.long.push(Math.round(e.duration)); });
      window.__po.observe({ type: 'longtask' });
      window.__mo = new MutationObserver(ms => { window.__m.muts += ms.length; window.__m.last = performance.now(); });
      window.__mo.observe(document.body, { childList: true, subtree: true, attributes: true });
      const t = performance.now();
      document.querySelector('.results-sim-reference-swap').click();
      window.__m.sync = Math.round(performance.now() - t);
    });
    await page.waitForFunction(() => performance.now() - window.__m.last > 1500);
    swaps.push(await page.evaluate(() => { window.__po.disconnect(); window.__mo.disconnect(); return { sync: window.__m.sync, settle: Math.round(window.__m.last - window.__m.t0), muts: window.__m.muts, longTasks: window.__m.long, dps: document.querySelector('.results-sim-dps .topline-result-avg').textContent, rows: document.querySelectorAll('.rotation-timeline .rotation-timeline-row').length, tippy: [...document.querySelectorAll('.rotation-timeline *')].filter(e => e._tippy).length }; }));
  }
  // hover a timeline cast to prove tooltips are alive after swaps
  const tooltipAlive = await page.evaluate(() => { const el = [...document.querySelectorAll('.rotation-timeline *')].find(e => e._tippy); if (!el) return null; el._tippy.show(); const shown = !!document.querySelector('[data-tippy-root]'); el._tippy.hide(); return shown; });
  return JSON.stringify({ url, sim1, sim2, tlOpen, swaps, tooltipAlive });
})
