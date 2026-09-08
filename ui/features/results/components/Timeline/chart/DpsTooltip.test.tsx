import type { DpsLog } from '@sim/proto/combat_log';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DpsTooltip } from './DpsTooltip';

const log = (over: Partial<DpsLog> = {}) =>
	({
		timestamp: 8.5,
		dps: 12345.678,
		damageLogs: [
			{
				actionId: { name: 'Fireball', iconUrl: 'fireball.png' },
				outcome: 'crit',
				effect: null,
				amount: 4000,
				tick: false,
				target: { isTarget: true, index: 0 },
			},
			{ actionId: { name: 'Ignite', iconUrl: '' }, outcome: 'miss', effect: null, amount: 0, tick: false, target: { isTarget: true, index: 0 } },
		],
		activeAuras: [],
		...over,
	}) as unknown as DpsLog;

describe('DpsTooltip', () => {
	it('heads with the timestamp and closes with the DPS at that point', () => {
		const { container } = render(<DpsTooltip log={log()} />);
		expect(container.querySelector('.timeline-tooltip-header')!.textContent).toBe('8.50s');
		expect(container.querySelector('.timeline-tooltip-body-row')!.textContent).toContain('12345.68');
	});

	it('renders each damage event through the shared result renderer', () => {
		const { container } = render(<DpsTooltip log={log()} />);
		const events = [...container.querySelectorAll('.timeline-dps-events li')];
		expect(events[0].textContent).toContain('Crit [Target 1] for 4000.00 damage');
		// An avoided outcome carries no amount.
		expect(events[1].textContent).toContain('Miss [Target 1]');
		expect(events[1].textContent).not.toContain('for');
	});

	it('adds the aura section only when auras were up', () => {
		expect(render(<DpsTooltip log={log()} />).container.querySelector('.timeline-tooltip-auras')).toBeNull();
		const withAuras = render(<DpsTooltip log={log({ activeAuras: [{ actionId: { name: 'Combustion', iconUrl: 'c.png' } }] as never })} />);
		expect(withAuras.container.querySelector('.timeline-active-auras')!.textContent).toContain('Combustion');
	});
});
