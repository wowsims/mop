// Per-spec smoke sweep: load, count pickers, Simulate, wait for a real result, collect console + page errors.
// Traps encoded here: .dps-action starts disabled; the result element is pre-filled with 0.00, so wait for the
// button to re-enable AND a '... DPS' label. Wrapped in parentheses so tsc (allowJs) parses it.
(async (page) => {
  await page.addInitScript(() => { window.alert = () => {}; });
  page.setDefaultTimeout(30000);
  page.on('dialog', d => d.dismiss().catch(() => {}));
  // DPS/tank specs only; healing specs are excluded on purpose (experimental, alert on load).
  // Run in 2-3 batches if the MCP backgrounds calls over ~120 s.
  const specs = ["death_knight/blood", "death_knight/frost", "death_knight/unholy", "druid/balance", "druid/feral", "druid/guardian", "hunter/beast_mastery", "hunter/marksmanship", "hunter/survival", "mage/arcane", "mage/fire", "mage/frost", "monk/brewmaster", "monk/windwalker", "paladin/protection", "paladin/retribution", "priest/shadow", "rogue/assassination", "rogue/combat", "rogue/subtlety", "shaman/elemental", "shaman/enhancement", "warlock/affliction", "warlock/demonology", "warlock/destruction", "warrior/arms", "warrior/fury", "warrior/protection"];
  const out = [];
  const t0 = Date.now();
  for (const s of specs) {
    const errs = [];
    const h = m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); };
    const pe = e => errs.push('pageerror: ' + String(e && e.message).slice(0, 200));
    page.on('console', h);
    page.on('pageerror', pe);
    const r = { spec: s };
    try {
      const tl = Date.now();
      await page.goto('http://localhost:3333/mop/' + s + '/');
      await page.waitForSelector('.dps-action:not([disabled])', { timeout: 30000 });
      r.loadMs = Date.now() - tl;
      await page.waitForTimeout(1500);
      const p = await page.evaluate(() => ({
        inputRoot: document.querySelectorAll('.input-root').length,
        iconPicker: document.querySelectorAll('.icon-picker-button').length,
      }));
      r.pickers = p.inputRoot + p.iconPicker;
      r.pickerBreakdown = p.inputRoot + '/' + p.iconPicker;
      const t = Date.now();
      await page.click('.dps-action');
      await page.waitForFunction(() => document.querySelector('.dps-action')?.disabled === true, null, { timeout: 8000 }).catch(() => {});
      await page.waitForFunction(() => {
        const b = document.querySelector('.dps-action');
        const d = document.querySelector('.results-sim-dps .topline-result-avg');
        return b && !b.disabled && d && /[A-Z]PS/.test(d.textContent || '');
      }, null, { timeout: 60000 });
      r.simMs = Date.now() - t;
      r.result = await page.evaluate(() => {
        const g = c => document.querySelector('.results-sim-' + c + ' .topline-result-avg')?.textContent?.trim().replace(/\s+/g, ' ');
        const sd = document.querySelector('.results-sim-dps .topline-result-stdev')?.textContent?.trim().replace(/\s+/g, ' ');
        return [g('dps'), sd, g('tps') ? '| ' + g('tps') : ''].filter(Boolean).join(' ');
      });
    } catch (e) { r.error = String(e).replace(/\s+/g, ' ').slice(0, 220); }
    page.off('console', h);
    page.off('pageerror', pe);
    r.consoleErrors = errs.filter(e => !/wowhead|404|Failed to load resource/i.test(e));
    out.push(r);
  }
  return JSON.stringify({ totalMs: Date.now() - t0, out });
})
