import { OtherAction } from '@generated/proto/common';
import { ResourceType } from '@generated/proto/spell';
import type { ActionId } from '@sim/proto/action_id';
import type { AuraStacksLog, CombatLog, Outcome } from '@sim/proto/combat_log';
import { Entity } from '@sim/proto/combat_log';
import type { SimResult, SimResultFilter } from '@sim/proto/sim_result';
import { describe, expect, it } from 'vitest';

import { buildReplayModel, mergeAdjacentAuras } from './build';
import type { ReplayAura } from './types';

/** Enough of an `ActionId` for the build to keep it and for `mergeAdjacentAuras` to key on it. */
const actionId = (name: string, overrides: Partial<Record<'spellId' | 'itemId' | 'otherId', number>> = {}): ActionId =>
	({
		name,
		iconUrl: `${name}.png`,
		spellId: 1,
		itemId: 0,
		otherId: OtherAction.OtherActionNone,
		toStringIgnoringTag: () => name,
		equals: (other: { name: string }) => other.name === name,
		...overrides,
	}) as unknown as ActionId;

const PLAYER = new Entity('Hero', '', 0, false, false);
const OTHER = new Entity('Someone Else', '', 1, false, false);

const cast = (timestamp: number, name: string, id: ActionId = actionId(name)): CombatLog =>
	({ kind: 'cast-began', timestamp, actionId: id, source: PLAYER }) as unknown as CombatLog;

const damage = (timestamp: number, name: string, amount: number, target: Entity, outcome: Outcome = 'hit'): CombatLog =>
	({ kind: 'damage', timestamp, actionId: actionId(name), source: PLAYER, target, amount, outcome }) as unknown as CombatLog;

const resource = (timestamp: number, resourceType: ResourceType, valueAfter: number, total: number): CombatLog =>
	({ kind: 'resource', timestamp, source: PLAYER, resourceType, valueAfter, total }) as unknown as CombatLog;

const uptime = (gainedAt: number, fadedAt: number, name: string, stacksChange: Array<{ timestamp: number; newStacks: number }> = []) => ({
	gainedAt,
	fadedAt,
	actionId: actionId(name),
	stacksChange: stacksChange as Array<AuraStacksLog>,
});

interface FakeUnit {
	name: string;
	index: number;
	auraUptimeLogs: Array<ReturnType<typeof uptime>>;
}

const unit = (name: string, index: number, auraUptimeLogs: Array<ReturnType<typeof uptime>> = []): FakeUnit => ({ name, index, auraUptimeLogs });

const simResult = (options: { duration?: number; logs?: Array<CombatLog>; players?: Array<FakeUnit>; targets?: Array<FakeUnit> } = {}) =>
	({
		result: { firstIterationDuration: options.duration ?? 30, avgIterationDuration: 0 },
		logs: options.logs ?? [],
		getPlayers: () => (options.players ?? [unit('Hero', 0)]).map(player => ({ ...player, getPlayerAndPetActions: () => [] })),
		getTargets: () => options.targets ?? [unit('Boss', 0)],
	}) as unknown as SimResult;

const build = (options: Parameters<typeof simResult>[0] = {}) => buildReplayModel(simResult(options), {} as SimResultFilter);

const aura = (gainedAt: number, fadedAt: number, name: string): ReplayAura => ({
	gainedAt,
	fadedAt,
	name,
	actionId: actionId(name),
	stacksChange: [],
});

describe('mergeAdjacentAuras', () => {
	it('joins a refresh onto the span it renewed', () => {
		const merged = mergeAdjacentAuras([aura(0, 10, 'Rend'), aura(10.03, 20, 'Rend')]);
		expect(merged).toHaveLength(1);
		expect(merged[0].fadedAt).toBe(20);
	});

	it('leaves a genuine reapplication as its own span', () => {
		const merged = mergeAdjacentAuras([aura(0, 10, 'Rend'), aura(10.06, 20, 'Rend')]);
		expect(merged.map(entry => entry.gainedAt)).toEqual([0, 10.06]);
	});

	it('never merges across spells', () => {
		expect(mergeAdjacentAuras([aura(0, 10, 'Rend'), aura(10, 20, 'Rip')])).toHaveLength(2);
	});

	it('does not touch the spans it was given', () => {
		const spans = [aura(0, 10, 'Rend'), aura(10, 20, 'Rend')];
		mergeAdjacentAuras(spans);
		expect(spans[0].fadedAt).toBe(10);
	});
});

describe('buildReplayModel', () => {
	it('falls back through the iteration durations', () => {
		expect(build({ duration: 0 }).duration).toBe(120);
		expect(
			buildReplayModel({ ...simResult(), result: { firstIterationDuration: 0, avgIterationDuration: 42 } } as unknown as SimResult, {} as SimResultFilter)
				.duration,
		).toBe(42);
	});

	it('keeps only the player casts, in log order', () => {
		const model = build({
			logs: [cast(1, 'Bolt'), { kind: 'cast-began', timestamp: 2, actionId: actionId('Theirs'), source: OTHER } as unknown as CombatLog, cast(3, 'Shot')],
		});
		expect(model.actions.map(entry => entry.name)).toEqual(['Bolt', 'Shot']);
	});

	it('drops a prepull cast and one with no spell behind it', () => {
		const model = build({
			logs: [cast(-1, 'Prepull'), cast(1, 'Other', actionId('Other', { otherId: OtherAction.OtherActionMove })), cast(2, 'Bolt')],
		});
		expect(model.actions.map(entry => entry.name)).toEqual(['Bolt']);
	});

	it('attaches the damage a cast landed within three seconds', () => {
		const boss = new Entity('Boss', '', 0, true, false);
		const model = build({
			logs: [cast(1, 'Bolt'), damage(1.4, 'Bolt', 500, boss, 'crit'), cast(10, 'Bolt'), damage(20, 'Bolt', 900, boss)],
		});
		expect(model.actions[0]).toMatchObject({ dmg: 500, isCrit: true });
		expect(model.actions[1]).toMatchObject({ dmg: null, isCrit: false });
	});

	it('lists each spell once for the action grid', () => {
		const model = build({ logs: [cast(1, 'Bolt'), cast(2, 'Shot'), cast(3, 'Bolt')] });
		expect(model.uniqueActions.map(entry => entry.name)).toEqual(['Bolt', 'Shot']);
		expect(model.uniqueActions[0].time).toBe(1);
	});

	it('files each hit under the enemy it landed on, and drops the avoided ones', () => {
		const first = new Entity('Boss', '', 0, true, false);
		const second = new Entity('Add', '', 1, true, false);
		const model = build({
			targets: [unit('Boss', 0), unit('Add', 1)],
			logs: [damage(1, 'Bolt', 100, first), damage(2, 'Bolt', 200, second), damage(3, 'Bolt', 400, first, 'dodge')],
		});
		expect(model.enemies.map(enemy => enemy.totalDamage)).toEqual([100, 200]);
		expect(model.enemies[0].cumulativeDamage).toEqual([100]);
	});

	it('draws at most eight cards and counts the rest', () => {
		const model = build({ targets: Array.from({ length: 11 }, (_, index) => unit(`Add ${index}`, index)) });
		expect(model.enemies).toHaveLength(8);
		expect(model.hiddenEnemyCount).toBe(3);
	});

	it('always has one enemy to draw, named after the dummy, when the filter leaves none', () => {
		const model = build({ targets: [] });
		expect(model.enemies).toHaveLength(1);
		expect(model.enemies[0].name).toBe('combat_replay.training_dummy');
		expect(model.hiddenEnemyCount).toBe(0);
	});

	it('leaves out an aura that was up for the whole fight', () => {
		const model = build({
			duration: 30,
			players: [unit('Hero', 0, [uptime(0, 30, 'Permanent'), uptime(5, 10, 'Cooldown')])],
		});
		expect(model.playerAuras.map(entry => entry.name)).toEqual(['Cooldown']);
	});

	it('merges the debuffs on one enemy without reaching across the pack', () => {
		const model = build({
			targets: [unit('Boss', 0, [uptime(0, 10, 'Rend')]), unit('Add', 1, [uptime(10, 20, 'Rend')])],
		});
		expect(model.enemies[0].auras.map(entry => entry.fadedAt)).toEqual([10]);
		expect(model.enemies[1].auras.map(entry => entry.gainedAt)).toEqual([10]);
	});

	it('leads the resource rows with the primary resource and keeps a per-type maximum', () => {
		const model = build({
			logs: [
				resource(1, ResourceType.ResourceTypeComboPoints, 3, 5),
				resource(2, ResourceType.ResourceTypeEnergy, 60, 100),
				resource(3, ResourceType.ResourceTypeHealth, 900, 1000),
			],
		});
		expect(model.resourceRows.map(row => row.type)).toEqual([ResourceType.ResourceTypeEnergy, ResourceType.ResourceTypeComboPoints]);
		expect(model.resourceRows.map(row => row.segmented)).toEqual([false, true]);
		expect(model.resourceRows.map(row => row.maxValue)).toEqual([100, 5]);
	});

	it('falls back to a default maximum for a resource the log never totalled', () => {
		const model = build({ logs: [resource(1, ResourceType.ResourceTypeChi, 2, 0)] });
		expect(model.resourceRows[0].maxValue).toBe(5);
	});

	it('collects the icons the replay will need', () => {
		const model = build({
			logs: [cast(1, 'Bolt'), cast(2, 'Bolt')],
			players: [unit('Hero', 0, [uptime(1, 2, 'Buff')])],
			targets: [unit('Boss', 0, [uptime(1, 2, 'Debuff')])],
		});
		expect(model.iconUrls).toEqual(['Bolt.png', 'Buff.png', 'Debuff.png']);
	});
});
