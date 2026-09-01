// Store contract test: facade writes must notify direct store subscribers
// exactly as the old event system did — once per changed field, equal-value
// writes suppressed, unconditional setters firing every call (version
// counters), batch() deferring subscribers to one fire with final state,
// aggregate selectors firing once per write. Run via the harness:
// HARNESS_ENTRY=tools/state-snapshots/store-contract-test.ts vite build -c vite.harness.mts
// && HARNESS_BUNDLE=store-contract-test.js node tools/state-snapshots/run.mjs
import '../../ui/warrior/arms/sim';

import { Player } from '../../ui/core/player';
import { PlayerSpecs } from '../../ui/core/player_specs';
import { APLRotation } from '../../ui/core/proto/apl';
import { Race, Spec, Stat } from '../../ui/core/proto/common';
import { Database } from '../../ui/core/proto_utils/database';
import { ItemSwapGear } from '../../ui/core/proto_utils/gear';
import { Sim } from '../../ui/core/sim';
import { batch, nextEventID } from '../../ui/core/state/batch';
import { Emitter } from '../../ui/core/state/events';
import { ReforgeSettings } from '../../ui/core/state/reforge_settings';
import { StatWeightActionSettings } from '../../ui/core/state/stat_weight_settings';
import { subscribeEncounterChange, subscribeEncounterField, subscribePartyChange, subscribePlayerChange, subscribePlayerField, subscribeRaidChange, subscribeRaidField, subscribeReforgeChange, subscribeReforgeField, subscribeSimChange, subscribeSimField, subscribeStatsInputs, subscribeStatWeightsChange, subscribeUnitMetadata } from '../../ui/core/state/subscriptions';

let failures = 0;
function check(cond: boolean, label: string) {
	if (cond) {
		console.log('PASS:', label);
	} else {
		failures++;
		console.log('FAIL:', label);
	}
}

export async function main() {
	const sim = new Sim();
	await Database.get();
	const player = new Player<any>(PlayerSpecs.fromProto(Spec.SpecArmsWarrior), sim);
	batch(() => sim.raid.setPlayer(nextEventID(), 0, player));

	// 1. Single guarded write: raw selector once + gated field subscriber once.
	let selectorFires = 0;
	const unsubRaw = sim.store.subscribe(
		s => s.players[player.storeKey].race,
		() => selectorFires++,
	);
	let raceFires = 0;
	const unsubRace = subscribePlayerField(player, 'race')(() => raceFires++);
	const newRace = player.getRace() == Race.RaceOrc ? Race.RaceTroll : Race.RaceOrc;
	player.setRace(nextEventID(), newRace);
	check(selectorFires === 1, 'raw selector fired once on setRace');
	check(raceFires === 1, 'field subscriber fired once on setRace');

	// 2. Equal-value write: guarded setter → no notification.
	player.setRace(nextEventID(), newRace);
	check(selectorFires === 1 && raceFires === 1, 'equal-value setRace does not notify');

	// 3. Unconditional setters fire every call (version counters).
	let epRatioFires = 0;
	const unsubEp = subscribePlayerField(player, 'epRatios')(() => epRatioFires++);
	const ratios = player.getEpRatios();
	player.setEpRatios(nextEventID(), ratios);
	player.setEpRatios(nextEventID(), ratios);
	check(epRatioFires === 2, 'setEpRatios notifies unconditionally (twice for two equal writes)');
	unsubEp();

	// 4. batch(): two setters, one aggregate fire, subscriber sees final state.
	let aggregateFires = 0;
	const unsubAgg = subscribePlayerChange(player)(() => aggregateFires++);
	batch(() => {
		player.setName(nextEventID(), 'StoreTest');
		player.setDistanceFromTarget(nextEventID(), 25);
	});
	check(aggregateFires === 1, 'batch() collapses two setters into one player aggregate fire');
	unsubAgg();

	// 5. Encounter write reaches the sim aggregate once.
	let simFires = 0;
	const unsubSim0 = subscribeSimChange(sim)(() => simFires++);
	sim.encounter.setDuration(nextEventID(), 123);
	check(simFires === 1, 'encounter setter propagates once to the sim aggregate');
	unsubSim0();

	// 6. Raid fields fire once per write; equal re-write suppressed.
	let raidBuffFires = 0;
	let numPartiesFires = 0;
	let dummiesFires = 0;
	const u6a = subscribeRaidField(sim.raid, 'buffs')(() => raidBuffFires++);
	const u6b = subscribeRaidField(sim.raid, 'numActiveParties')(() => numPartiesFires++);
	const u6c = subscribeRaidField(sim.raid, 'targetDummies')(() => dummiesFires++);
	const rb = sim.raid.getBuffs();
	rb.arcaneBrilliance = !rb.arcaneBrilliance;
	sim.raid.setBuffs(nextEventID(), rb);
	sim.raid.setBuffs(nextEventID(), rb);
	sim.raid.setNumActiveParties(nextEventID(), 3);
	sim.raid.setTargetDummies(nextEventID(), 2);
	check(raidBuffFires === 1, 'raid buffs notified once (equal re-write suppressed)');
	check(numPartiesFires === 1, 'numActiveParties notified once');
	check(dummiesFires === 1, 'targetDummies notified once');
	u6a();
	u6b();
	u6c();

	// 7. Batch gate mechanics on a gated field subscriber.
	let gatedFires = 0;
	let seenDuringBatch = -1;
	const unsubGated = subscribePlayerField(player, 'name')(() => {
		gatedFires++;
		seenDuringBatch = player.getName() === 'Batched2' ? 1 : 0;
	});
	batch(() => {
		player.setName(nextEventID(), 'Batched1');
		player.setName(nextEventID(), 'Batched2');
		check(gatedFires === 0, 'gated subscriber deferred inside batch()');
	});
	check(gatedFires === 1, 'gated subscriber fired exactly once after the batch');
	check(seenDuringBatch === 1, 'gated subscriber saw final state');
	player.setName(nextEventID(), 'Unbatched');
	check(gatedFires === 2, 'gated subscriber fires immediately outside a batch');
	unsubGated();
	player.setName(nextEventID(), 'AfterUnsub');
	check(gatedFires === 2, 'unsubscribed gated subscriber stays silent');

	// 8. Counter-only fields: rotation, itemSwap, lastUsedRngSeed.
	let rotFires = 0;
	const unsubRot = subscribePlayerField(player, 'rotation')(() => rotFires++);
	player.setAplRotation(nextEventID(), APLRotation.create({ type: 2 }));
	player.touchRotation(nextEventID());
	check(rotFires === 2, 'rotation counter: setAplRotation + touchRotation notify once each');
	unsubRot();
	let swapFires = 0;
	const unsubSwap = subscribePlayerField(player, 'itemSwap')(() => swapFires++);
	player.itemSwapSettings.setEnableItemSwap(nextEventID(), true);
	player.itemSwapSettings.setEnableItemSwap(nextEventID(), true);
	player.itemSwapSettings.setGear(nextEventID(), new ItemSwapGear({}));
	check(swapFires === 1, 'itemSwap: guarded setters notify once for one real change');
	check(player.itemSwapSettings.getEnableItemSwap() === true, 'itemSwap facade reads store');
	unsubSwap();
	let seedFires = 0;
	const unsubSeed = subscribeSimField(sim, 'lastUsedRngSeedVersion')(() => seedFires++);
	(sim as any).nextRngSeed();
	(sim as any).nextRngSeed();
	check(seedFires === 2, 'lastUsedRngSeed notifies unconditionally per nextRngSeed');
	unsubSeed();

	// 9. Composition + aggregate selectors.
	let compFires = 0;
	let partyAgg = 0;
	let raidAgg = 0;
	let simAgg = 0;
	let encAgg = 0;
	const party0 = sim.raid.getParty(0);
	const unsubComp = subscribeRaidField(sim.raid, 'composition')(() => compFires++);
	const unsubParty = subscribePartyChange(party0)(() => partyAgg++);
	const unsubRaid = subscribeRaidChange(sim.raid)(() => raidAgg++);
	const unsubSim = subscribeSimChange(sim)(() => simAgg++);
	const unsubEnc = subscribeEncounterChange(sim.encounter)(() => encAgg++);
	player.setDistanceFromTarget(nextEventID(), 7);
	check(partyAgg === 1 && raidAgg === 1 && simAgg === 1 && encAgg === 0, `player field change → party/raid/sim aggregates once (${partyAgg}/${raidAgg}/${simAgg}/${encAgg})`);
	const player2 = new Player<any>(PlayerSpecs.fromProto(Spec.SpecArmsWarrior), sim);
	partyAgg = raidAgg = simAgg = 0;
	party0.setPlayer(nextEventID(), 1, player2);
	check(compFires === 1, 'composition write notifies once');
	check(partyAgg === 1 && raidAgg === 1 && simAgg === 1, `comp change → party/raid/sim aggregates once (${partyAgg}/${raidAgg}/${simAgg})`);
	check(sim.store.getState().raid.composition[0][1] === player2.storeKey, 'composition slice holds the new storeKey');
	encAgg = 0;
	sim.encounter.setDuration(nextEventID(), 321);
	check(encAgg === 1, 'encounter aggregate fires once for setDuration');
	let targetFires = 0;
	const unsubTargets = subscribeEncounterField(sim.encounter, 'targets')(() => targetFires++);
	sim.encounter.modifyTarget(nextEventID(), 0, t => (t.level = 92));
	sim.encounter.modifyTarget(nextEventID(), 99, t => (t.level = 1)); // missing index: still notifies, no throw
	check(targetFires === 2 && sim.encounter.getTarget(0)!.level === 92, 'modifyTarget replace-on-write notifies (incl. missing-index case)');
	unsubTargets();
	unsubComp();
	unsubParty();
	unsubRaid();
	unsubSim();
	unsubEnc();

	// 10. Plain Emitter.
	const em = new Emitter<number>();
	let got = 0;
	const off = em.on(v => (got += v));
	em.emit(2);
	off();
	em.emit(5);
	check(got === 2, 'Emitter on/emit/off');

	// 11. Satellites: reforge slice, stat-weight slice, unit metadata counter.
	const reforge = new ReforgeSettings(player, {});
	let rfField = 0;
	let rfSub = 0;
	const unsubRfField = subscribeReforgeField(reforge, 'includeGems')(() => rfField++);
	const unsubRf = subscribeReforgeChange(reforge)(() => rfSub++);
	reforge.setIncludeGems(nextEventID(), true);
	reforge.setIncludeGems(nextEventID(), true);
	check(rfField === 1 && rfSub === 1, `reforge field write → field/aggregate subscribers once (${rfField}/${rfSub})`);
	check(reforge.includeGems === true, 'reforge facade reads the store');
	reforge.setFrozenItemSlot(nextEventID(), 0, true);
	check(reforge.getFrozenItemSlot(0) && rfField === 1, 'frozen slot write bumps freezeItemSlots only');
	unsubRfField();
	unsubRf();

	const sw = new StatWeightActionSettings(player, '__store_contract_sw__');
	let swSub = 0;
	const unsubSw = subscribeStatWeightsChange(sw)(() => swSub++);
	sw.setStatExcluded(nextEventID(), player.getEpWeights().asUnitStatArray()[0][0], true);
	check(swSub === 1, 'stat-weight exclusion notifies once');
	check(!!window.localStorage.getItem('__store_contract_sw__'), 'stat-weight settings persisted to localStorage');
	unsubSw();

	let metaSub = 0;
	const unsubMeta = subscribeUnitMetadata(sim)(() => metaSub++);
	sim.store.setState(st => ({ sim: { ...st.sim, metadataVersion: st.sim.metadataVersion + 1 } }));
	check(metaSub === 1, 'metadataVersion bump notifies once');
	unsubMeta();

	// 12. setGearAsync resolves when currentStats is written.
	let resolved = false;
	const p = player.setGearAsync(nextEventID(), player.getGear().withChallengeMode(false), true).then(() => (resolved = true));
	player.setCurrentStats(nextEventID(), player.getCurrentStats());
	await Promise.race([p, new Promise(r => setTimeout(r, 500))]);
	check(resolved, 'setGearAsync resolves on the next currentStats write');

	unsubRaw();
	unsubRace();
	// Server-derived stats must NOT count as a player/raid/sim change (old
	// Player.changeEmitter excluded currentStats; including it would loop
	// updateCharacterStats → setCurrentStats → change → updateCharacterStats).
	let derivedPlayerFires = 0, derivedRaidFires = 0, derivedSimFires = 0;
	const unsubDP = subscribePlayerChange(player)(() => derivedPlayerFires++);
	const unsubDR = subscribeRaidChange(sim.raid)(() => derivedRaidFires++);
	const unsubDS = subscribeSimChange(sim)(() => derivedSimFires++);
	player.setCurrentStats(nextEventID(), player.getCurrentStats());
	check(derivedPlayerFires === 0 && derivedRaidFires === 0 && derivedSimFires === 0, 'setCurrentStats does not fire player/raid/sim aggregates');
	unsubDP(); unsubDR(); unsubDS();

	// Stats-input selector: one batch touching raid + encounter → one fire.
	let statsFires = 0;
	const unsubStats = subscribeStatsInputs(sim)(() => statsFires++);
	batch(() => {
		sim.raid.setTargetDummies(nextEventID(), 4);
		sim.encounter.setDuration(nextEventID(), 321);
	});
	check(statsFires === 1, 'subscribeStatsInputs fires once for a batch touching raid + encounter');
	unsubStats();

	// epRefStat write is a player change (autosave) and fires the field counter.
	let refFires = 0;
	let refPlayerFires = 0;
	const unsubRef = subscribePlayerField(player, 'epRefStat')(() => refFires++);
	const unsubRefP = subscribePlayerChange(player)(() => refPlayerFires++);
	player.setRefStat(nextEventID(), 'dpsRefStat', Stat.StatStrength);
	player.setRefStat(nextEventID(), 'dpsRefStat', Stat.StatStrength); // equal → guarded
	check(refFires === 1 && refPlayerFires === 1 && player.getRefStat('dpsRefStat') === Stat.StatStrength, 'setRefStat fires epRefStat + player change once');
	unsubRef();
	unsubRefP();

	// Player.dispose removes the slice and stops the challenge-mode reaction.
	const temp = new Player<any>(PlayerSpecs.fromProto(Spec.SpecArmsWarrior), sim);
	const tempKey = temp.storeKey;
	check(!!sim.store.getState().players[tempKey], 'temp player seeded a slice');
	temp.dispose();
	check(temp.isDisposed(), 'disposed player reports isDisposed');
	await new Promise(r => setTimeout(r, 0));
	check(sim.store.getState().players[tempKey] === undefined, 'Player.dispose removed the slice (next tick)');

	// Party.setPlayer discard rule: a displaced player is disposed on the next
	// microtask unless it was re-placed (a move/swap); removals never dispose.
	const p0 = sim.raid.getParty(0);
	const a = new Player<any>(PlayerSpecs.fromProto(Spec.SpecArmsWarrior), sim);
	const b = new Player<any>(PlayerSpecs.fromProto(Spec.SpecArmsWarrior), sim);
	p0.setPlayer(nextEventID(), 1, a);
	p0.setPlayer(nextEventID(), 2, b);
	// move a from slot 1 to slot 3 (removal + re-place): must not dispose
	p0.setPlayer(nextEventID(), 3, a);
	// swap: b displaces a in slot 3, a re-placed into slot 2 in the same task
	p0.setPlayer(nextEventID(), 3, b);
	p0.setPlayer(nextEventID(), 2, a);
	await new Promise(r => setTimeout(r, 0));
	check(!a.isDisposed() && !b.isDisposed(), 'moves/swaps do not dispose players');
	// replacement: c displaces a; a is not re-placed → disposed
	const c = new Player<any>(PlayerSpecs.fromProto(Spec.SpecArmsWarrior), sim);
	p0.setPlayer(nextEventID(), 2, c);
	await new Promise(r => setTimeout(r, 0));
	check(a.isDisposed() && !c.isDisposed(), 'replaced player is disposed, replacement is not');
	await new Promise(r => setTimeout(r, 0));
	check(sim.store.getState().players[a.storeKey] === undefined, 'replaced player slice removed');
	p0.setPlayer(nextEventID(), 1, null); p0.setPlayer(nextEventID(), 2, null); p0.setPlayer(nextEventID(), 3, null);

	console.log(failures === 0 ? 'STORE-CONTRACT OK' : `STORE-CONTRACT FAILED (${failures})`);
	if (failures > 0) process.exitCode = 1;
}
