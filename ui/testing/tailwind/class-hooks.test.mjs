import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { findClassHooks, findTestidStyling } from './class-hooks.mjs';
import { findDefaultCss } from './canonical-classes.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const CSS_PATH = findDefaultCss(REPO_ROOT);

async function testFindClassHooks() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'class-hooks-fixture-'));
	fs.mkdirSync(path.join(dir, 'ui/styles'), { recursive: true });

	fs.writeFileSync(
		path.join(dir, 'ui/class_hook_allowlist.json'),
		JSON.stringify([
			{ token: 'sim-ui', reason: 'test fixture' },
			{ pattern: '^group\\/.+$', reason: 'test fixture' },
		]),
	);

	fs.writeFileSync(path.join(dir, 'ui/Widget.tsx'), ['const a = <div className="p-2 hover:bg-primary ui-foo foo-bar sim-ui group/item" />;'].join('\n'));
	fs.writeFileSync(path.join(dir, 'ui/Widget.test.tsx'), 'const a = <div className="only-in-test" />;');

	const hooks = await findClassHooks(dir, { css: CSS_PATH });
	const tokens = hooks.map(h => h.token);

	assert.ok(!tokens.includes('p-2'), 'a plain utility must not be flagged');
	assert.ok(!tokens.includes('hover:bg-primary'), 'a variant plus utility must not be flagged');
	assert.ok(!tokens.includes('ui-foo'), 'a ui-* class must not be flagged');
	assert.ok(!tokens.includes('sim-ui'), 'an allowlisted token must not be flagged');
	assert.ok(!tokens.includes('group/item'), 'an allowlisted pattern must not be flagged');
	assert.ok(!tokens.includes('only-in-test'), 'a *.test.tsx literal must not be flagged');
	assert.deepEqual(tokens, ['foo-bar'], 'only the real hook token should be flagged');

	fs.rmSync(dir, { recursive: true, force: true });
}

function testFindTestidStyling() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'class-hooks-testid-fixture-'));
	fs.mkdirSync(path.join(dir, 'ui'), { recursive: true });

	fs.writeFileSync(path.join(dir, 'ui/Widget.tsx'), 'const a = <div className="[&_[data-testid=x]]:p-0" />;\n');
	fs.writeFileSync(path.join(dir, 'ui/Widget.css'), '.ui-widget[data-testid="x"] { color: red; }\n');

	const hits = findTestidStyling(dir);
	assert.equal(hits.length, 2);
	assert.ok(hits.some(h => h.file === 'ui/Widget.tsx' && h.match.includes('[&_[data-testid=x]]:p-0')));
	assert.ok(hits.some(h => h.file === 'ui/Widget.css'));

	fs.rmSync(dir, { recursive: true, force: true });
}

async function main() {
	await testFindClassHooks();
	testFindTestidStyling();
	console.log('class-hooks.test.mjs: all tests passed');
}

main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
