import type { SpellSchool as SpellSchoolValue } from '@generated/proto/common';
import type { DamageLog, Entity } from '@sim/proto/combat_log';
import { SpellSchool } from '@sim/proto/names';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DamageResult } from './DamageResult';

const target = { name: 'Boss', ownerName: '', index: 0, isTarget: true, isPet: false } as Entity;

const damage = (extra: Partial<DamageLog>) =>
	({ kind: 'damage', outcome: 'hit', effect: 'damage', amount: 1234.5, tick: false, target, spellSchool: null, ...extra }) as DamageLog;

describe('DamageResult', () => {
	it('names the outcome, the target and the amount with its school', () => {
		const { container } = render(
			<DamageResult
				log={damage({
					outcome: 'crit', // `spellSchoolNames` is keyed on the bitmask enum in `names.ts`, which is not the generated one the log declares.
					spellSchool: SpellSchool.Physical as unknown as SpellSchoolValue,
				})}
			/>,
		);

		expect(container.textContent).toBe('Crit [Target 1] for 1234.50 damage (Physical).');
		expect(container.querySelector('strong')!.className).toBe('text-danger spell-school-physical');
	});

	// A periodic hit reads as a Tick, but a periodic crit still reads as a Crit.
	it('calls a periodic plain hit a Tick and leaves a periodic crit alone', () => {
		expect(render(<DamageResult log={damage({ tick: true })} />).container.textContent).toContain('Tick');
		expect(render(<DamageResult log={damage({ tick: true, outcome: 'crit' })} />).container.textContent).toContain('Crit');
	});

	it('reports healing and shielding as health rather than as an outcome', () => {
		const healed = render(<DamageResult log={damage({ effect: 'healing' })} />).container;
		// The double space is intentional: 'Healed ' already ends in one.
		expect(healed.textContent).toBe('Healed  [Target 1] for 1234.50 health.');
		expect(healed.querySelector('strong')!.className).toBe('resource-health');

		expect(render(<DamageResult log={damage({ effect: 'shielding' })} />).container.textContent).toBe('Shielded  [Target 1] for 1234.50 health.');
	});

	// A miss carries no amount clause at all, so printing "for 0.00 damage" would be a fabrication.
	it('stops after the target on a miss, a dodge and a parry', () => {
		for (const outcome of ['miss', 'dodge', 'parry'] as const) {
			const { container } = render(<DamageResult log={damage({ outcome, effect: null, amount: 0 })} />);
			expect(container.textContent).toBe(`${outcome[0].toUpperCase()}${outcome.slice(1)} [Target 1]`);
			expect(container.querySelector('strong')).toBeNull();
		}
	});
});
