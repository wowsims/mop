import { Class, PseudoStat, Race, Spec, Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { Stats, UnitStat } from '@sim/proto/stats';
import { createSimStore, PLAYER_FIELDS, type PlayerSlice, seedKeyed, zeroVersions } from '@sim/state/sim_store';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CharacterStats } from './CharacterStats';

const KEY = 7;

const DISPLAY_STATS = [
	UnitStat.fromStat(Stat.StatAttackPower),
	UnitStat.fromPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent),
	UnitStat.fromPseudoStat(PseudoStat.PseudoStatPhysicalCritPercent),
];

const CRIT_CAP_INFO = {
	meleeCrit: 30,
	meleeHit: 7.5,
	expertise: 15,
	suppression: 3,
	glancing: 24,
	hasOffhandWeapon: true,
	meleeHitCap: 7.5,
	expertiseCap: 15,
	remainingMeleeHitCap: 0,
	remainingExpertiseCap: 0,
	baseCritCap: 43,
	specSpecificOffset: 0,
	playerCritCapDelta: -13,
};

const renderStats = (settled: boolean) => {
	const store = createSimStore();
	const currentStats = settled ? { finalStats: new Stats().toProto() } : {};
	seedKeyed(store, 'players', KEY, {
		name: 'P',
		race: Race.RaceOrc,
		gear: { id: 'gear' },
		bonusStats: new Stats(),
		inFrontOfTarget: false,
		currentStats,
		v: zeroVersions(PLAYER_FIELDS),
	} as unknown as PlayerSlice);

	const player = {
		sim: { store },
		storeKey: KEY,
		getPlayerSpec: () => ({ isTankSpec: false, isMeleeDpsSpec: true }),
		getClass: () => Class.ClassWarrior,
		getSpec: () => Spec.SpecFuryWarrior,
		getRace: () => Race.RaceOrc,
		getActiveRacialExpertiseBonuses: () => [false, false],
		getCurrentStats: () => currentStats,
		getBaseMastery: () => 8,
		getMasteryPerPointModifier: () => 1,
		getMeleeCritCap: () => CRIT_CAP_INFO.playerCritCapDelta,
		getMeleeCritCapInfo: () => CRIT_CAP_INFO,
	};

	const host = { player, individualConfig: { displayStats: DISPLAY_STATS, epReferenceStat: Stat.StatAgility } } as never;
	const view = render(
		<SimHostProvider host={host}>
			<CharacterStats />
		</SimHostProvider>,
	);
	const rows = Array.from(view.container.querySelectorAll('[data-testid="character-stats-table-row"]'));
	return { view, rows };
};

const critCapRow = (rows: Array<Element>) => {
	const row = rows.at(-1)!;
	expect(row.querySelector('.ui-character-stats-label')!.textContent).toBe(i18n.t('sidebar.character_stats.melee_crit_cap'));
	return row;
};

describe('CharacterStats loading state', () => {
	it('shows a skeleton in every row, crit cap included, while the stats are still loading', () => {
		const { view, rows } = renderStats(false);

		expect(rows.length).toBe(DISPLAY_STATS.length + 1);
		expect(view.container.querySelector('table')!.getAttribute('aria-busy')).toBe('true');
		for (const row of rows) expect(row.querySelector('.ui-character-stats-value > .ui-skeleton')).not.toBeNull();
		expect(view.container.querySelectorAll('[data-testid="stat-value-link"]').length).toBe(0);
		expect(critCapRow(rows).textContent).toBe(i18n.t('sidebar.character_stats.melee_crit_cap'));
	});

	it('replaces every skeleton with its value once the stats arrive', () => {
		const { view, rows } = renderStats(true);

		expect(rows.length).toBe(DISPLAY_STATS.length + 1);
		expect(view.container.querySelector('table')!.hasAttribute('aria-busy')).toBe(false);
		expect(view.container.querySelectorAll('.ui-skeleton').length).toBe(0);
		expect(view.container.querySelectorAll('[data-testid="stat-value-link"]').length).toBe(rows.length);
		expect(critCapRow(rows).querySelector('[data-testid="stat-value-link"]')!.textContent).toContain('13.00%');
	});
});
