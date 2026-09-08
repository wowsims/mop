import { ResourceType } from '@generated/proto/spell';
import type { CombatLog, Entity } from '@sim/proto/combat_log';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LogLine } from './LogLine';

// The anchor's own behaviour is `ActionLink`'s test; here it only has to be identifiable in the line.
vi.mock('./ActionLink', () => ({ ActionLink: ({ isAura }: { isAura?: boolean }) => <a className="log-action" data-aura={String(!!isAura)} /> }));

const player = { name: 'Warrior', ownerName: '', index: 0, isTarget: false, isPet: false } as Entity;
const boss = { name: 'Boss', ownerName: '', index: 0, isTarget: true, isPet: false } as Entity;

const base = { logIndex: 0, timestamp: 1, source: player, target: null, actionId: {}, actionIdAsString: null, spellSchool: null, threat: 0, activeAuras: [] };
const line = (extra: Record<string, unknown>) => ({ ...base, raw: '[1.00] raw', ...extra }) as unknown as CombatLog;

const text = (log: CombatLog) => render(<LogLine log={log} />).container.textContent;

describe('LogLine', () => {
	it('trails a damage line with its threat, and drops it for a line the target dealt', () => {
		expect(text(line({ kind: 'damage', outcome: 'hit', effect: 'damage', amount: 10, tick: false, target: boss, threat: 25 }))).toContain('(25.00 Threat)');
		expect(text(line({ kind: 'damage', outcome: 'hit', effect: 'damage', amount: 10, tick: false, source: boss, target: boss, threat: 25 }))).not.toContain(
			'Threat',
		);
	});

	// The raw values already moved the right way, so a spend flips the difference back to positive:
	// the line reads "Spent 30.0 Rage", not "Spent -30.0 Rage".
	it('signs a resource line by whether it was spent, and names health losses differently', () => {
		const resource = { kind: 'resource', resourceType: ResourceType.ResourceTypeRage, valueBefore: 100, valueAfter: 70, total: 100 };
		expect(text(line({ ...resource, isSpend: true }))).toContain('Spent');
		expect(text(line({ ...resource, isSpend: true }))).toContain('30.0 Rage');
		expect(text(line({ ...resource, isSpend: false, valueBefore: 70, valueAfter: 100 }))).toContain('Gained');
		expect(text(line({ ...resource, resourceType: ResourceType.ResourceTypeHealth, isSpend: true }))).toContain('Lost');
		expect(text(line({ ...resource, resourceType: ResourceType.ResourceTypeHealth, isSpend: false }))).toContain('Recovered');
	});

	it('says which way an aura went', () => {
		expect(text(line({ kind: 'aura', isGained: true, isFaded: false }))).toContain('gained');
		expect(text(line({ kind: 'aura', isGained: false, isFaded: true }))).toContain('faded');
		expect(text(line({ kind: 'aura', isGained: false, isFaded: false }))).toContain('refreshed');
	});

	// The two aura kinds are the only ones whose tooltip is the buff rather than the spell.
	it('resolves an aura line against the buff aura', () => {
		const auraLink = (log: CombatLog) =>
			render(<LogLine log={log} />)
				.container.querySelector('.log-action')!
				.getAttribute('data-aura');
		expect(auraLink(line({ kind: 'aura', isGained: true, isFaded: false }))).toBe('true');
		expect(auraLink(line({ kind: 'aura-stacks', oldStacks: 1, newStacks: 2 }))).toBe('true');
		expect(auraLink(line({ kind: 'major-cooldown' }))).toBe('false');
	});

	// The bracket in the raw text is dropped because EntityLabel renders a styled replacement; the
	// second space is the parser's own, kept so the line still matches the plain-text export.
	it('drops the entity bracket the parser left in the raw line, because the label replaces it', () => {
		expect(text(line({ kind: 'plain', raw: '[1.00] [Warrior 1] said something' }))).toBe('[Warrior 1]  said something');
	});

	it('keeps an unparseable raw line whole', () => {
		expect(text(line({ kind: 'plain', raw: 'no timestamp here', source: null }))).toBe('no timestamp here');
	});

	// Every kind the union declares has to reach a branch; a missing one renders undefined, silently.
	it('renders something for every kind that reaches the list', () => {
		const kinds: Array<Record<string, unknown>> = [
			{ kind: 'damage', outcome: 'hit', effect: 'damage', amount: 1, tick: false, target: boss },
			{ kind: 'resource', resourceType: ResourceType.ResourceTypeRage, valueBefore: 1, valueAfter: 2, isSpend: false, total: 100 },
			{ kind: 'aura', isGained: true, isFaded: false },
			{ kind: 'aura-stacks', oldStacks: 1, newStacks: 2 },
			{ kind: 'major-cooldown' },
			{ kind: 'cast-began', castTime: 1.5, manaCost: 100 },
			{ kind: 'cast-cancelled', cancelTime: 0.5 },
			{ kind: 'cast-completed', actionId: { name: 'Shield Slam' } },
			{ kind: 'stat-change', isGain: true, stats: '+100 Strength' },
			{ kind: 'resource-group', resourceType: ResourceType.ResourceTypeRage, valueBefore: 1, valueAfter: 2 },
			{ kind: 'cast', actionId: { name: 'Shield Slam' }, castTime: 1 },
			{ kind: 'plain' },
			{ kind: 'dps' },
			{ kind: 'threat-group' },
			{ kind: 'aura-uptime' },
		];
		for (const extra of kinds) expect(text(line(extra))!.length).toBeGreaterThan(0);
	});
});
