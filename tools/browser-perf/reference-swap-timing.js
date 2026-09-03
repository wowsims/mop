// Times swapping between the current result and a saved reference, back and forth. This is
// what the live-subtree slot cache in timeline.tsx exists for: both results keep their DOM,
// their tippy instances and their emitter subscriptions, so a swap moves nodes instead of
// rebuilding them.
//
// Wrapped in parentheses so tsc (allowJs) parses it as an expression statement.
async page => {
	page.setDefaultTimeout(240000);
	const URL = process.env.WOWSIMS_URL || 'http://localhost:3333/mop/death_knight/unholy/';

	const OBSERVE = () => {
		window.__m = { long: [], muts: 0, t0: performance.now(), last: performance.now() };
		window.__po = new PerformanceObserver(l => {
			for (const e of l.getEntries()) window.__m.long.push(Math.round(e.duration));
		});
		window.__po.observe({ type: 'longtask' });
		window.__mo = new MutationObserver(ms => {
			window.__m.muts += ms.length;
			window.__m.last = performance.now();
		});
		window.__mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
	};

	const COLLECT = () => {
		window.__po.disconnect();
		window.__mo.disconnect();
		return {
			sync: Math.round(window.__m.sync ?? 0),
			settle: Math.round(window.__m.last - window.__m.t0),
			muts: window.__m.muts,
			longTasks: window.__m.long,
			rotationRows: document.querySelectorAll('.rotation-timeline > div').length,
			rotationNodes: document.querySelectorAll('.rotation-timeline *').length,
			// Live tippy instances: a swap that loses these has rebuilt the subtree.
			liveTippies: [...document.querySelectorAll('#timelineTab *')].filter(e => e._tippy).length,
			heapMb: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
			firstCastLeft: document.querySelector('.rotation-timeline-cast')?.style.left ?? null,
		};
	};

	const clickByText = text => [...document.querySelectorAll('.nav-link')].find(a => (a.textContent || '').trim() === text)?.click();

	await page.goto(URL);
	await page.waitForSelector('.dps-action');
	await page.waitForTimeout(3000);
	await page.evaluate(() => {
		const key = Object.keys(localStorage).find(k => k.endsWith('__currentSettings__'));
		if (!key) return;
		const settings = JSON.parse(localStorage.getItem(key));
		settings.settings = { ...settings.settings, fixedRngSeed: '20260903' };
		localStorage.setItem(key, JSON.stringify(settings));
	});
	await page.reload();
	await page.waitForSelector('.dps-action');
	await page.waitForTimeout(3000);

	await page.evaluate(clickByText, 'Results');
	await page.waitForTimeout(800);
	await page.evaluate(() => document.querySelector('.dps-action').click());
	await page.waitForTimeout(9000);
	await page.evaluate(clickByText, 'Timeline');
	await page.waitForTimeout(2500);

	const out = {};
	// Save the current result as the reference, then run a different sim so the two differ.
	// A swap between identical results is a no-op and times as zero.
	await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /reference/i.test(b.textContent || ''))?.click());
	await page.waitForTimeout(1500);
	await page.evaluate(() => document.querySelector('.dps-action').click());
	await page.waitForTimeout(9000);
	const swap = async () => {
		await page.evaluate(OBSERVE);
		await page.evaluate(() => {
			const btn = [...document.querySelectorAll('button')].find(
				b => /swap/i.test(b.textContent || '') || /swap/i.test(b.getAttribute('aria-label') || ''),
			);
			const t = performance.now();
			btn.click();
			window.__m.sync = performance.now() - t;
		});
		await page.waitForFunction(() => performance.now() - window.__m.last > 1200);
		return await page.evaluate(COLLECT);
	};

	// Six swaps: odd ones show the reference, even ones the current result. After the first
	// pair both subtrees are cached, so 3-6 are the steady-state numbers that matter.
	out.swaps = [];
	for (let i = 0; i < 6; i++) {
		out.swaps.push(await swap());
		await page.waitForTimeout(700);
	}
	return JSON.stringify(out, null, 2);
};
