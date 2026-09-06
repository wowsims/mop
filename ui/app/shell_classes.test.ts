import type { PlayerSpec } from '@domain/player_spec';
import { describe, expect, it } from 'vitest';

import { metricVisibilityClasses, showsEpRatios, simTypeClasses, simUiClasses } from './shell_classes';

const spec = (parts: Partial<PlayerSpec<any>>) =>
	({ isHealingSpec: false, isTankSpec: false, isMeleeDpsSpec: false, isRangedDpsSpec: false, ...parts }) as PlayerSpec<any>;

const tokens = (classes: string) => classes.split(' ').filter(Boolean).sort();

const ALL_ON = { damage: true, threat: true, healing: true, epRatios: true, experimental: true };

describe('simTypeClasses', () => {
	it('emits one type, and a range only for dps', () => {
		expect(tokens(simTypeClasses(spec({ isHealingSpec: true })))).toEqual(['sim-type--heal']);
		expect(tokens(simTypeClasses(spec({ isTankSpec: true })))).toEqual(['sim-type--tank']);
		expect(tokens(simTypeClasses(spec({ isMeleeDpsSpec: true })))).toEqual(['sim-type--dps', 'sim-type--melee']);
		expect(tokens(simTypeClasses(spec({ isRangedDpsSpec: true })))).toEqual(['sim-type--dps', 'sim-type--ranged']);
	});

	// A healer that also melees is a healer: the original was an if/else-if chain, and the order of
	// its branches is the behaviour.
	it('prefers heal over tank over dps when a spec is more than one', () => {
		expect(tokens(simTypeClasses(spec({ isHealingSpec: true, isTankSpec: true, isMeleeDpsSpec: true })))).toEqual(['sim-type--heal']);
		expect(tokens(simTypeClasses(spec({ isTankSpec: true, isMeleeDpsSpec: true })))).toEqual(['sim-type--tank']);
	});

	it('emits nothing for a spec that is none of them', () => {
		expect(simTypeClasses(spec({}))).toBe('');
	});
});

describe('metricVisibilityClasses', () => {
	it('hides nothing when everything is on', () => {
		expect(metricVisibilityClasses(ALL_ON)).toBe('');
	});

	it('hides each metric independently', () => {
		expect(tokens(metricVisibilityClasses({ ...ALL_ON, damage: false }))).toContain('hide-damage-metrics');
		expect(tokens(metricVisibilityClasses({ ...ALL_ON, healing: false }))).toContain('hide-healing-metrics');
		expect(tokens(metricVisibilityClasses({ ...ALL_ON, experimental: false }))).toContain('hide-experimental');
	});

	// EP ratios compare columns, so they need more than one column to be showing. Three fields feed
	// this one class, which is why it is the rule most likely to be got wrong.
	it('shows ep ratios whenever threat is on, whatever else is off', () => {
		expect(showsEpRatios({ damage: false, healing: false, threat: true })).toBe(true);
	});

	it('shows ep ratios without threat only when damage and healing are both on', () => {
		expect(showsEpRatios({ damage: true, healing: true, threat: false })).toBe(true);
		expect(showsEpRatios({ damage: true, healing: false, threat: false })).toBe(false);
		expect(showsEpRatios({ damage: false, healing: true, threat: false })).toBe(false);
	});

	// `epRatios` is a field rather than something this function derives, because the shell subscribes
	// it to a different set of store fields than the healing class — see MetricVisibility.
	it('hides ep ratios from its own flag, not from the others', () => {
		expect(tokens(metricVisibilityClasses({ ...ALL_ON, epRatios: false }))).toContain('hide-ep-ratios');
		expect(tokens(metricVisibilityClasses({ damage: false, healing: false, threat: false, epRatios: true, experimental: false }))).not.toContain(
			'hide-ep-ratios',
		);
	});
});

describe('simUiClasses', () => {
	it('always carries the two roots and the spec class', () => {
		const classes = tokens(simUiClasses({ cssClass: 'arms-warrior-sim-ui', spec: spec({ isMeleeDpsSpec: true }), metrics: ALL_ON }));
		expect(classes).toEqual(['arms-warrior-sim-ui', 'individual-sim-ui', 'sim-type--dps', 'sim-type--melee', 'sim-ui']);
	});

	it('adds every hide class when the toggles are all off', () => {
		const classes = tokens(
			simUiClasses({
				cssClass: 'holy-priest-sim-ui',
				spec: spec({ isHealingSpec: true }),
				metrics: { damage: false, threat: false, healing: false, epRatios: false, experimental: false },
			}),
		);
		expect(classes).toEqual([
			'hide-damage-metrics',
			'hide-ep-ratios',
			'hide-experimental',
			'hide-healing-metrics',
			'hide-threat-metrics',
			'holy-priest-sim-ui',
			'individual-sim-ui',
			'sim-type--heal',
			'sim-ui',
		]);
	});
});
