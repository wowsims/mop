// Golden snapshot generator for the state/UI separation refactor.
//
// For every launched spec: construct Sim + Player (no UI), apply the spec's
// defaults (a UI-free mirror of IndividualSimUI.applyDefaults, minus the
// reforger / stat-weight / preset-build satellites), and emit the serialized
// settings protos. The output must stay byte-identical across refactor PRs —
// any diff means behavior changed.
//
// Spec registration happens via module side effects:
import '../../ui/death_knight/blood/sim';
import '../../ui/death_knight/frost/sim';
import '../../ui/death_knight/unholy/sim';
import '../../ui/druid/balance/sim';
import '../../ui/druid/feral/sim';
import '../../ui/druid/guardian/sim';
import '../../ui/druid/restoration/sim';
import '../../ui/hunter/beast_mastery/sim';
import '../../ui/hunter/marksmanship/sim';
import '../../ui/hunter/survival/sim';
import '../../ui/mage/arcane/sim';
import '../../ui/mage/fire/sim';
import '../../ui/mage/frost/sim';
import '../../ui/monk/brewmaster/sim';
import '../../ui/monk/mistweaver/sim';
import '../../ui/monk/windwalker/sim';
import '../../ui/paladin/holy/sim';
import '../../ui/paladin/protection/sim';
import '../../ui/paladin/retribution/sim';
import '../../ui/priest/discipline/sim';
import '../../ui/priest/holy/sim';
import '../../ui/priest/shadow/sim';
import '../../ui/rogue/assassination/sim';
import '../../ui/rogue/combat/sim';
import '../../ui/rogue/subtlety/sim';
import '../../ui/shaman/elemental/sim';
import '../../ui/shaman/enhancement/sim';
import '../../ui/shaman/restoration/sim';
import '../../ui/warlock/affliction/sim';
import '../../ui/warlock/demonology/sim';
import '../../ui/warlock/destruction/sim';
import '../../ui/warrior/arms/sim';
import '../../ui/warrior/fury/sim';
import '../../ui/warrior/protection/sim';

import { IndividualSimUIConfig } from '../../ui/core/individual_sim_ui';
import { getSpecConfig, Player } from '../../ui/core/player';
import { PlayerSpecs } from '../../ui/core/player_specs';
import { APLRotation, APLRotation_Type as APLRotationType } from '../../ui/core/proto/apl';
import { Cooldowns, Glyphs, Profession, Spec } from '../../ui/core/proto/common';
import { Database } from '../../ui/core/proto_utils/database';
import { Sim } from '../../ui/core/sim';
import { batch, nextEventID } from '../../ui/core/state/batch';
import { applyIndividualSimSettings, individualSimSettingsToProto } from '../../ui/core/state/serialization';
import { makeMemoryEnv } from './memory_env';
// Mirror of IndividualSimUI.applyDefaults (individual_sim_ui.tsx) without the
// UI-owned satellites (reforger, statWeightActionSettings, defaultBuild).
// When the defaults logic moves into ui/core/state/, replace this mirror with
// a call to the real implementation — snapshot diffs then verify the move.
function applySpecDefaults(sim: Sim, player: Player<any>, config: IndividualSimUIConfig<any>) {
	const eventID = nextEventID();
	batch(() => {
		const tankSpec = player.getPlayerSpec().isTankSpec;
		const healingSpec = player.getPlayerSpec().isHealingSpec;

		player.applySharedDefaults(eventID);
		player.setRace(eventID, config.defaults.other?.race || player.getPlayerClass().races[0]);
		player.setGear(eventID, sim.db.lookupEquipmentSpec(config.defaults.gear));
		player.setConsumes(eventID, config.defaults.consumables);

		const defaultRotationType = config.defaults.rotationType || APLRotationType.TypeAuto;
		player.setAplRotation(eventID, APLRotation.create({ type: defaultRotationType }));
		if (config.defaults.simpleRotation) {
			player.setSimpleRotation(eventID, config.defaults.simpleRotation);
			player.setSimpleCooldowns(eventID, Cooldowns.create({ hpPercentForDefensives: tankSpec ? 0.4 : 0 }));
		}

		player.setTalentsString(eventID, config.defaults.talents.talentsString);
		player.setGlyphs(eventID, config.defaults.talents.glyphs || Glyphs.create());
		player.setSpecOptions(eventID, config.defaults.specOptions);
		player.setBuffs(eventID, config.defaults.individualBuffs);
		player.getParty()!.setBuffs(eventID, config.defaults.partyBuffs);
		player.getRaid()!.setBuffs(eventID, config.defaults.raidBuffs);
		player.setEpWeights(eventID, config.defaults.epWeights);
		if (config.defaults.itemSwap) {
			player.itemSwapSettings.setItemSwapSettings(eventID, true, sim.db.lookupItemSwap(config.defaults.itemSwap));
		}

		player.setEpRatios(eventID, player.getDefaultEpRatios(tankSpec, healingSpec));
		player.setProfession1(eventID, config.defaults.other?.profession1 || Profession.Engineering);
		player.setProfession2(eventID, config.defaults.other?.profession2 === undefined ? Profession.Jewelcrafting : config.defaults.other.profession2);
		player.setDistanceFromTarget(eventID, config.defaults.other?.distanceFromTarget || 0);
		player.setChannelClipDelay(eventID, config.defaults.other?.channelClipDelay || 0);
		player.setReactionTime(eventID, config.defaults.other?.reactionTime || 100);

		sim.raid.setTargetDummies(eventID, healingSpec ? 9 : 0);
		if (config.defaults.encounter?.encounter) {
			sim.encounter.fromProto(eventID, config.defaults.encounter.encounter);
		} else {
			sim.encounter.applyDefaults(eventID);
		}
		sim.encounter.setExecuteProportion90(eventID, config.defaults.other?.highHpThreshold || 0.9);
		sim.raid.setDebuffs(eventID, config.defaults.debuffs);
		sim.applyDefaults(eventID, tankSpec, healingSpec);
		if (config.defaults.other?.iterationCount) {
			sim.setIterations(eventID, config.defaults.other.iterationCount);
		}
		sim.raid.setTanks(eventID, tankSpec ? [player.makeUnitReference()] : []);
	});
}

const bigintReplacer = (_k: string, v: unknown) => (typeof v === 'bigint' ? v.toString() : v);

export async function main() {
	await Database.get();
	const out: Record<string, unknown> = {};

	for (const spec of Object.values(Spec)) {
		if (typeof spec !== 'number' || spec === Spec.SpecUnknown) continue;
		let config: IndividualSimUIConfig<any>;
		try {
			config = getSpecConfig(spec) as IndividualSimUIConfig<any>;
		} catch {
			continue; // spec not launched/registered
		}

		const sim = new Sim({ env: makeMemoryEnv() });
		await Database.get();
		const playerSpec = PlayerSpecs.fromProto(spec);
		const player = new Player<any>(playerSpec, sim);
		const initID = nextEventID();
		batch(() => {
			sim.raid.setPlayer(initID, 0, player);
		});

		applySpecDefaults(sim, player, config);

		// One canonicalization round trip first: Sim.toProto collapses
		// "all selected" filter arrays to [] and fromProto re-expands them, so
		// the serialized form is only a fixed point from the second pass on.
		// This is existing behavior we snapshot, not a bug we fix here.
		const canonID = nextEventID();
		player.fromProto(canonID, player.toProto(false));
		sim.fromProto(canonID, sim.toProto());
		sim.encounter.fromProto(nextEventID(), sim.encounter.toProto());

		const playerProto = player.toProto(false);
		const simProto = sim.toProto();
		const raidProto = sim.raid.toProto();
		const encounterProto = sim.encounter.toProto();

		// Serialize BEFORE the round trip: Sim.fromProto mutates its argument
		// in place (it expands empty filter arrays on the passed proto).
		const playerJson = JSON.stringify(playerProto, bigintReplacer);
		const simJson = JSON.stringify(simProto, bigintReplacer);
		const raidJson = JSON.stringify(raidProto, bigintReplacer);
		const encounterJson = JSON.stringify(encounterProto, bigintReplacer);

		// fromProto(toProto) round trip must now be a fixed point.
		const rtID = nextEventID();
		player.fromProto(rtID, playerProto);
		sim.fromProto(rtID, simProto);
		sim.encounter.fromProto(nextEventID(), encounterProto);
		const roundTripStable =
			JSON.stringify(player.toProto(false), bigintReplacer) === playerJson &&
			JSON.stringify(sim.toProto(), bigintReplacer) === simJson &&
			JSON.stringify(sim.encounter.toProto(), bigintReplacer) === encounterJson;

		// IndividualSimSettings envelope round trip (serialization.ts). A minimal
		// context: no reforge settings, defaults as fallback EP weights.
		const ctx = {
			player,
			sim,
			reforgeSettings: undefined,
			defaultEpWeights: player.getEpWeights(),
			refStats: {},
		};
		const envelopeProto = individualSimSettingsToProto(ctx);
		const envelopeJson = JSON.stringify(envelopeProto, bigintReplacer);
		applyIndividualSimSettings(nextEventID(), ctx, envelopeProto);
		const envelopeStable = JSON.stringify(individualSimSettingsToProto(ctx), bigintReplacer) === envelopeJson;

		out[PlayerSpecs.getFullSpecName(playerSpec)] = {
			roundTripStable,
			envelopeStable,
			envelope: JSON.parse(envelopeJson),
			player: JSON.parse(playerJson),
			sim: JSON.parse(simJson),
			raid: JSON.parse(raidJson),
			encounter: JSON.parse(encounterJson),
		};
	}

	console.log(JSON.stringify(out, null, '\t'));
}
