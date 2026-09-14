import type { PlayerSpec } from '@sim/player/player_spec';
import { describe, expect, it } from 'vitest';

import { showsEpRatios, simUiAttributes, simUiClasses } from './shell_classes';

const spec = (parts: Partial<PlayerSpec<any>>) =>
	({ isHealingSpec: false, isTankSpec: false, isMeleeDpsSpec: false, isRangedDpsSpec: false, ...parts }) as PlayerSpec<any>;

const tokens = (classes: string) => classes.split(' ').filter(Boolean).sort();

describe('showsEpRatios', () => {
	it('shows ep ratios whenever threat is on, whatever else is off', () => {
		expect(showsEpRatios({ damage: false, healing: false, threat: true })).toBe(true);
	});

	it('shows ep ratios without threat only when damage and healing are both on', () => {
		expect(showsEpRatios({ damage: true, healing: true, threat: false })).toBe(true);
		expect(showsEpRatios({ damage: true, healing: false, threat: false })).toBe(false);
		expect(showsEpRatios({ damage: false, healing: true, threat: false })).toBe(false);
	});
});

describe('simUiClasses', () => {
	it('always carries the two roots and the class name', () => {
		const classes = tokens(simUiClasses({ className: 'arms-warrior-sim-ui', spec: spec({ isMeleeDpsSpec: true }) }));
		expect(classes).toEqual(['arms-warrior-sim-ui', 'group/sim', 'sim-ui']);
	});
});

describe('simUiAttributes', () => {
	it('emits a sim type and an attack only for the dps case', () => {
		expect(simUiAttributes({ spec: spec({ isTankSpec: true }) })['data-sim-type']).toBe('tank');
		expect(simUiAttributes({ spec: spec({ isTankSpec: true }) })['data-sim-attack']).toBeUndefined();

		expect(simUiAttributes({ spec: spec({ isMeleeDpsSpec: true }) })['data-sim-type']).toBe('dps');
		expect(simUiAttributes({ spec: spec({ isMeleeDpsSpec: true }) })['data-sim-attack']).toBe('melee');
	});
});
