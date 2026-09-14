import type { PlayerSpec } from '@sim/player/player_spec';
import { describe, expect, it } from 'vitest';

import { showsEpRatios, simTypeClasses, simUiAttributes, simUiClasses } from './shell_classes';

const spec = (parts: Partial<PlayerSpec<any>>) =>
	({ isHealingSpec: false, isTankSpec: false, isMeleeDpsSpec: false, isRangedDpsSpec: false, ...parts }) as PlayerSpec<any>;

const tokens = (classes: string) => classes.split(' ').filter(Boolean).sort();

describe('simTypeClasses', () => {
	it('emits one type, and a range only for dps', () => {
		expect(tokens(simTypeClasses(spec({ isHealingSpec: true })))).toEqual(['sim-type--heal']);
		expect(tokens(simTypeClasses(spec({ isTankSpec: true })))).toEqual(['sim-type--tank']);
		expect(tokens(simTypeClasses(spec({ isMeleeDpsSpec: true })))).toEqual(['sim-type--dps', 'sim-type--melee']);
		expect(tokens(simTypeClasses(spec({ isRangedDpsSpec: true })))).toEqual(['sim-type--dps', 'sim-type--ranged']);
	});

	it('prefers heal over tank over dps when a spec is more than one, as the original if/else-if chain did', () => {
		expect(tokens(simTypeClasses(spec({ isHealingSpec: true, isTankSpec: true, isMeleeDpsSpec: true })))).toEqual(['sim-type--heal']);
		expect(tokens(simTypeClasses(spec({ isTankSpec: true, isMeleeDpsSpec: true })))).toEqual(['sim-type--tank']);
	});

	it('emits nothing for a spec that is none of them', () => {
		expect(simTypeClasses(spec({}))).toBe('');
	});
});

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
	it('always carries the two roots and the spec class', () => {
		const classes = tokens(simUiClasses({ className: 'arms-warrior-sim-ui', spec: spec({ isMeleeDpsSpec: true }) }));
		expect(classes).toEqual(['arms-warrior-sim-ui', 'group/sim', 'sim-type--dps', 'sim-type--melee', 'sim-ui']);
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
