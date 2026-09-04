// Shared plumbing for the React-migration checks. See README.md.
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// The repo has no Playwright dependency (the browser MCP normally drives it), so fall back to
// whatever `npx playwright-core` last cached rather than adding one for four scripts.
const loadChromium = async () => {
	try {
		return (await import('playwright-core')).chromium;
	} catch {
		const cache = join(homedir(), '.npm', '_npx');
		for (const dir of readdirSync(cache)) {
			const entry = join(cache, dir, 'node_modules', 'playwright-core', 'index.mjs');
			try {
				return (await import(entry)).chromium;
			} catch {
				// Not this cache entry.
			}
		}
		throw new Error('playwright-core not found. Run `npx playwright-core --help` once to cache it.');
	}
};

export const SPECS = ['warrior/arms', 'mage/fire', 'hunter/beast_mastery', 'monk/windwalker', 'priest/shadow'];

// Two static servers: the parent branch's build and this one's. See README.md.
export const PORTS = { base: Number(process.env.BASE_PORT ?? 3401), react: Number(process.env.REACT_PORT ?? 3402) };

export const specsFromArgv = () => (process.argv[2] ? process.argv[2].split(',') : SPECS);

// Present identically on both sides under a static server: the Go host's /version endpoint does not
// exist, and GitHub rate-limits the unauthenticated release check.
export const ENVIRONMENTAL = /Failed to load resource/;

export const launch = async () => (await loadChromium()).launch({ headless: true, args: ['--no-sandbox'] });

/** Opens a spec page and waits for the shell. `errors` collects page errors and non-environmental console errors. */
export const openSpec = async (browser, port, spec, { selector = '.sim-ui', settle = 2500 } = {}) => {
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', e => errors.push(String(e)));
	page.on('console', m => {
		if (m.type() === 'error' && !ENVIRONMENTAL.test(m.text())) errors.push('console: ' + m.text());
	});
	// A modal dialog would block every later command.
	await page.addInitScript(() => {
		window.alert = () => {};
	});
	await page.goto(`http://localhost:${port}/mop/${spec}/`, { waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector(selector, { timeout: 60000 });
	await page.waitForTimeout(settle);
	return { page, errors };
};
