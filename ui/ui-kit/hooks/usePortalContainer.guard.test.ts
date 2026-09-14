import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const uiKitRoot = path.resolve(here, '..');
const appRoot = path.resolve(here, '../../app');

const walk = (dir: string): Array<string> =>
	readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return walk(full);
		return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [full] : [];
	});

const relative = (file: string) => path.relative(path.resolve(here, '../../..'), file).replaceAll('\\', '/');

const IMPORTS_HOOK = /usePortalContainer/;

const LOCAL_SLOT_REASON = 'renders into a sibling slot right after its trigger, so Base UI does not reorder the tab sequence away from it';

const PORTAL_EXCEPTIONS: Record<string, string> = {
	'ui-kit/MultiIconPicker/MultiIconPicker.tsx': LOCAL_SLOT_REASON,
	'ui-kit/DropdownPicker/DropdownMenu.tsx': LOCAL_SLOT_REASON,
	'ui-kit/IconEnumPicker/IconEnumPicker.tsx': LOCAL_SLOT_REASON,
	'app/landing/LandingClassMenu.tsx': LOCAL_SLOT_REASON,
};

const OVERLAY_PORTAL_EXCEPTIONS: Record<string, string> = {
	'app/SimTabs.tsx': 'a layout slot for the tab panes, not an overlay',
};

describe('portal root guard', () => {
	it('every Base UI .Portal in ui-kit and app goes through usePortalContainer, or is a documented exception', () => {
		const offenders: Array<string> = [];
		for (const file of [...walk(uiKitRoot), ...walk(appRoot)]) {
			const contents = readFileSync(file, 'utf-8');
			if (!/\.Portal\b/.test(contents)) continue;
			const key = relative(file).replace(/^ui\//, '');
			if (IMPORTS_HOOK.test(contents)) continue;
			if (key in PORTAL_EXCEPTIONS) continue;
			offenders.push(key);
		}
		expect(offenders).toEqual([]);
	});

	it('every createPortal for an overlay goes through usePortalContainer, or is a documented exception', () => {
		const offenders: Array<string> = [];
		for (const file of [...walk(uiKitRoot), ...walk(appRoot)]) {
			const contents = readFileSync(file, 'utf-8');
			if (!contents.includes('createPortal(')) continue;
			const key = relative(file).replace(/^ui\//, '');
			if (IMPORTS_HOOK.test(contents)) continue;
			if (key in OVERLAY_PORTAL_EXCEPTIONS) continue;
			offenders.push(key);
		}
		expect(offenders).toEqual([]);
	});
});
