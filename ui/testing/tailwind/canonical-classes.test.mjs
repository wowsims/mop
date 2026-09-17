// Fixture tests for canonical-classes.mjs, run directly with node (assert-based, no test
// runner dependency beyond what the repo already has).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { __unstable__loadDesignSystem } from '@tailwindcss/node';

import { deriveClassAttrs, findNonCanonical } from './canonical-classes.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const CSS_PATH = path.join(REPO_ROOT, 'ui/styles/style.css');

const CASES = [
	['p-[5px]', 'p-1.25'],
	['mt-[3px]', 'mt-0.75'],
	['w-[18px]', 'w-4.5'],
	['data-[stuck]:bg-background', 'data-stuck:bg-background'],
	['hover:data-[stuck]:bg-background', 'hover:data-stuck:bg-background'],
	['[scrollbar-width:none]', 'scrollbar-none'],
	['ease-[cubic-bezier(0.4,0,0.2,1)]', 'ease-in-out'],
	['flex-[2]', 'flex-2'],
	['!flex', 'flex!'],
	['md:p-[5px]', 'md:p-1.25'],
];

async function testDesignSystemCases() {
	const css = fs.readFileSync(CSS_PATH, 'utf8');
	const designSystem = await __unstable__loadDesignSystem(css, { base: path.dirname(CSS_PATH) });
	for (const [from, to] of CASES) {
		const [canonical] = designSystem.canonicalizeCandidates([from], { rem: 16 });
		assert.equal(canonical, to, `${from} should canonicalize to ${to}, got ${canonical}`);
	}

	for (const already of ['p-1.25', 'ease-[ease-in-out]', 'border-[3px]', 'flex']) {
		const [canonical] = designSystem.canonicalizeCandidates([already], { rem: 16 });
		assert.equal(canonical, already, `${already} should stay unchanged, got ${canonical}`);
	}

	for (const notTailwind of ['ui-log-inline-picker', 'ui-foo-bar']) {
		const [canonical] = designSystem.canonicalizeCandidates([notTailwind], { rem: 16 });
		assert.equal(canonical, notTailwind, `${notTailwind} is not Tailwind and must not be reported`);
	}
}

async function testFixtureTree() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-fixture-'));
	fs.mkdirSync(path.join(dir, 'ui/styles'), { recursive: true });
	fs.mkdirSync(path.join(dir, 'ui/specs'), { recursive: true });
	fs.mkdirSync(path.join(dir, 'ui/generated'), { recursive: true });

	fs.writeFileSync(
		path.join(dir, 'ui/Widget.tsx'),
		[
			'const a = <div className="p-[5px] flex ui-widget-root" />;',
			"const b = <div triggerClassName={'w-[18px]'} />;",
			'const cond = clsx("mt-[3px]", isOpen && "data-[stuck]:bg-background", extra);',
			'const dyn = <div className={`ease-[cubic-bezier(0.4,0,0.2,1)] ${size}`} />;',
			'const obj = { iconClassName: "flex-[2]", extraClassNames: ["border-[3px]"] };',
		].join('\n'),
	);
	fs.writeFileSync(path.join(dir, 'ui/Widget.css'), '.ui-widget {\n  @apply p-[5px] flex;\n}\n');
	fs.writeFileSync(
		path.join(dir, 'ui/specs/Widget.spec.tsx'),
		['const s = <div className="p-[5px]" data-testid={clsx("mt-[3px]")} />;', 'const c = <div className={clsx("w-[18px]")} />;'].join('\n'),
	);
	fs.writeFileSync(path.join(dir, 'ui/generated/gen.ts'), 'const g = <div className="p-[5px]" />;');

	const results = await findNonCanonical(dir, { css: CSS_PATH });
	const byFrom = Object.fromEntries(results.map(r => [`${r.file}:${r.from}`, r.to]));

	assert.equal(byFrom['ui/Widget.tsx:p-[5px]'], 'p-1.25');
	assert.equal(byFrom['ui/Widget.tsx:w-[18px]'], 'w-4.5');
	assert.equal(byFrom['ui/Widget.tsx:mt-[3px]'], 'mt-0.75');
	assert.equal(byFrom['ui/Widget.tsx:data-[stuck]:bg-background'], 'data-stuck:bg-background');
	assert.equal(byFrom['ui/Widget.tsx:ease-[cubic-bezier(0.4,0,0.2,1)]'], 'ease-in-out');
	assert.equal(byFrom['ui/Widget.tsx:flex-[2]'], 'flex-2');
	assert.equal(byFrom['ui/Widget.tsx:border-[3px]'], undefined);
	assert.equal(byFrom['ui/Widget.css:p-[5px]'], 'p-1.25');

	assert.equal(byFrom['ui/specs/Widget.spec.tsx:p-[5px]'], 'p-1.25');
	assert.equal(byFrom['ui/specs/Widget.spec.tsx:mt-[3px]'], undefined, 'non-className clsx call in ui/specs must be skipped');
	assert.equal(byFrom['ui/specs/Widget.spec.tsx:w-[18px]'], 'w-4.5', 'a className={clsx(...)} site in ui/specs must still be reported');

	assert.equal(byFrom['ui/generated/gen.ts:p-[5px]'], undefined, 'generated files must be skipped');

	const found = results.some(r => r.file === 'ui/Widget.tsx' && r.from === 'ui-widget-root');
	assert.equal(found, false, 'ui-* classes are not Tailwind and must not be reported');

	fs.rmSync(dir, { recursive: true, force: true });
}

function testDeriveClassAttrs() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-attrs-fixture-'));
	fs.mkdirSync(path.join(dir, 'ui'), { recursive: true });

	fs.writeFileSync(
		path.join(dir, 'ui/Widget.tsx'),
		[
			'const a = <div rootClassName="p-2" iconGroupClassName={\'p-2\'} />;',
			"const b = ({ headerClassName = '' }: Props) => <div headerClassName={headerClassName} />;",
			'const notAnAttr = someValue;',
			'const spaced = value;',
		].join('\n'),
	);

	const attrs = deriveClassAttrs(dir);

	assert.ok(attrs.includes('className'), 'className is always included');
	assert.ok(attrs.includes('rootClassName'), 'rootClassName must be derived from the tree');
	assert.ok(attrs.includes('iconGroupClassName'), 'a multi-word *ClassName attribute must be derived');
	assert.ok(attrs.includes('headerClassName'), 'a destructured prop default counts as an attribute site');
	assert.ok(!attrs.includes('notAnAttr'), 'a plain identifier must not be treated as a class attribute');

	fs.rmSync(dir, { recursive: true, force: true });
}

async function main() {
	await testDesignSystemCases();
	await testFixtureTree();
	testDeriveClassAttrs();
	console.log('canonical-classes.test.mjs: all tests passed');
}

main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
