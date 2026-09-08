import { ResourceType } from '@generated/proto/spell';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AuraItem, CastItem, ResourceItem, RowItem, TickItem } from '../../../view/timeline/rotation/model';
import { RowItemTooltip } from './RowItemTooltip';

const text = (item: RowItem) => render(<RowItemTooltip item={item} />).container.textContent!;

const damage = (amount: number) => ({
	timestamp: 1.5,
	amount,
	threat: 40.25,
	outcome: 'hit',
	effect: null,
	tick: false,
	source: { isTarget: false },
	target: { isTarget: true, index: 0 },
});

const cast = (over: Record<string, unknown> = {}) =>
	({
		kind: 'cast',
		start: 0,
		end: 1,
		log: {
			actionId: { name: 'Fireball' },
			timestamp: 2,
			castTime: 1.5,
			effectiveTime: 1.5,
			travelTime: 0,
			cancelTime: 0,
			castCancelledLog: null,
			damageDealtLogs: [],
			...over,
		},
	}) as unknown as CastItem;

describe('RowItemTooltip', () => {
	it('gives a cast its window, its cast time and its GCD time', () => {
		expect(text(cast())).toContain('Fireball from 2.00s to 3.50s (1.50s, 1.50s GCD Time)');
	});

	it('reports a cancel instead of a GCD, at the point it was cancelled', () => {
		expect(text(cast({ castCancelledLog: { timestamp: 2.75 }, cancelTime: 0.75 }))).toContain('Fireball from 2.00s to 2.75s (Cancelled after 0.75s)');
	});

	it('adds travel time when the spell had any', () => {
		expect(text(cast({ travelTime: 0.4 }))).toContain('+ 0.40s travel time');
	});

	it('totals a cast’s damage and its damage per effective time, and lists the hits with their threat', () => {
		const withDamage = text(cast({ damageDealtLogs: [damage(3000), damage(1500)] }));
		expect(withDamage).toContain('Total: 4500.00 (3000.00 DPET)');
		expect(withDamage).toContain('1.50s - Hit [Target 1] for 3000.00 damage');
		expect(withDamage).toContain('(40.3 results_tab.details.timeline.tooltips.threat)');
	});

	it('leaves the total out of a cast that dealt none', () => {
		expect(text(cast())).not.toContain('Total:');
	});

	it('gives a tick its time, its action and its result', () => {
		const tick = { kind: 'tick', start: 4, end: 4, log: { ...damage(900), actionId: { name: 'Ignite' } } } as unknown as TickItem;
		expect(text(tick)).toContain('1.50s - Ignite Hit [Target 1] for 900.00 damage');
	});

	it('gives an aura the window it was up for', () => {
		const aura = { kind: 'aura', start: 1, end: 5, log: { actionId: { name: 'Combustion' }, gainedAt: 1, fadedAt: 5.5 } } as unknown as AuraItem;
		expect(text(aura)).toBe('Combustion: 1.00s - 5.50s');
	});

	it('gives a resource block the value it started from as its maximum', () => {
		const resource = {
			kind: 'resource',
			start: 0,
			end: 1,
			startValue: 200,
			log: {
				resourceType: ResourceType.ResourceTypeMana,
				timestamp: 1,
				valueBefore: 200,
				valueAfter: 100,
				logs: [],
				activeAuras: [{ actionId: { name: 'X', iconUrl: '' } }],
			},
		} as unknown as ResourceItem;
		const rendered = text(resource);
		expect(rendered).toContain('200.0 (100%)');
		// The rotation's own blocks never list auras: the row beneath already shows them.
		expect(rendered).not.toContain('active_auras');
	});
});
