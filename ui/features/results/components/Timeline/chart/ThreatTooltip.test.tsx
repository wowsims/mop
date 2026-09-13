import type { ThreatLogGroup } from '@sim/proto/combat_log';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThreatTooltip } from './ThreatTooltip';

const log = {
	timestamp: 3.25,
	threatBefore: 1000.4,
	threatAfter: 2500.6,
	logs: [{ threat: 1500.2, actionId: { name: 'Shield Slam', iconUrl: 's.png' } }],
	activeAuras: [],
} as unknown as ThreatLogGroup;

describe('ThreatTooltip', () => {
	it('brackets the events with the threat before and after them', () => {
		const { container } = render(<ThreatTooltip log={log} />);
		const rows = [...container.querySelectorAll('.timeline-tooltip-body-row')];
		expect(rows[0].textContent).toContain('1000.4');
		expect(rows[1].textContent).toContain('2500.6');
		expect(container.querySelector('.timeline-threat-events li')!.textContent).toContain('1500.2');
	});
});
