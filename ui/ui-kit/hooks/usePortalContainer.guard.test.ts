import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const uiKitRoot = path.resolve(here, '..');
const appRoot = path.resolve(here, '../../app');
const featuresRoot = path.resolve(here, '../../features');

const walk = (dir: string): Array<string> =>
	readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return walk(full);
		return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [full] : [];
	});

const relative = (file: string) => path.relative(path.resolve(here, '../../..'), file).replaceAll('\\', '/');

const IMPORTS_HOOK = /usePortalContainer/;

const PORTAL_EXCEPTIONS: Record<string, string> = {
	'app/landing/LandingClassMenu.tsx':
		"keepMounted, one per class (34 on the page): each class's spec links sit in the document at rest, directly after that class's trigger, for a crawler or screen reader reading the page top to bottom. Moving all 34 to the shared root would detach every list from its heading and append it at the document end, changing that reading order. The landing page carries no sidebar/z-1 stacking context, so the sidebar-clipping bug this unit fixes elsewhere does not apply here. Kept local to its own wrapper div.",
};

const OVERLAY_PORTAL_EXCEPTIONS: Record<string, string> = {
	'app/SimTabs.tsx': 'a layout slot for the tab panes, not an overlay',
	'features/results/components/LogRunner/LogRunner.tsx':
		"portals its sticky header into DrStickySlotContext's dr-sticky-slot, a layout slot in DetailedResults.tsx, not an overlay",
	'features/results/components/Timeline/rotation/RotationView.tsx':
		"portals its sticky header into DrStickySlotContext's dr-sticky-slot, a layout slot in DetailedResults.tsx, not an overlay",
};

describe('portal root guard', () => {
	it('every Base UI .Portal in ui-kit, app and features goes through usePortalContainer, or is a documented exception', () => {
		const offenders: Array<string> = [];
		for (const file of [...walk(uiKitRoot), ...walk(appRoot), ...walk(featuresRoot)]) {
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
		for (const file of [...walk(uiKitRoot), ...walk(appRoot), ...walk(featuresRoot)]) {
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
