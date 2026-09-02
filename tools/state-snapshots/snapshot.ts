// Golden snapshot generator for the state/UI separation refactor.
//
// For every launched spec: construct Sim + Player (no UI), apply the spec's
// defaults (a UI-free mirror of IndividualSimUI.applyDefaults, minus the
// reforger / stat-weight / preset-build satellites), and emit the serialized
// settings protos. The output must stay byte-identical across refactor PRs —
// any diff means behavior changed.
//
// Every spec is a declarative `spec.ts` default export, registered explicitly below.
import { IndividualSimUIConfig } from '../../ui/app/individual_sim_ui';
import { APLRotation, APLRotation_Type as APLRotationType } from '../../ui/core/proto/apl';
import { Cooldowns, Glyphs, Profession, Spec } from '../../ui/core/proto/common';
import { getSpecConfig, Player } from '../../ui/domain/player';
import { PlayerSpecs } from '../../ui/domain/player_specs';
import { Database } from '../../ui/domain/proto_utils/database';
import { Sim } from '../../ui/domain/sim';
import { batch, nextEventID } from '../../ui/domain/state/batch';
import { applyIndividualSimSettings, individualSimSettingsToProto } from '../../ui/domain/state/serialization';
import { registerSpecConfig } from '../../ui/features/spec_config';
import bloodDeathKnightSpec from '../../ui/sims/death_knight/blood/spec';
import frostDeathKnightSpec from '../../ui/sims/death_knight/frost/spec';
import unholyDeathKnightSpec from '../../ui/sims/death_knight/unholy/spec';
import balanceDruidSpec from '../../ui/sims/druid/balance/spec';
import feralDruidSpec from '../../ui/sims/druid/feral/spec';
import guardianDruidSpec from '../../ui/sims/druid/guardian/spec';
import restorationDruidSpec from '../../ui/sims/druid/restoration/spec';
import beastMasteryHunterSpec from '../../ui/sims/hunter/beast_mastery/spec';
import marksmanshipHunterSpec from '../../ui/sims/hunter/marksmanship/spec';
import survivalHunterSpec from '../../ui/sims/hunter/survival/spec';
import arcaneMageSpec from '../../ui/sims/mage/arcane/spec';
import fireMageSpec from '../../ui/sims/mage/fire/spec';
import frostMageSpec from '../../ui/sims/mage/frost/spec';
import brewmasterMonkSpec from '../../ui/sims/monk/brewmaster/spec';
import mistweaverMonkSpec from '../../ui/sims/monk/mistweaver/spec';
import windwalkerMonkSpec from '../../ui/sims/monk/windwalker/spec';
import holyPaladinSpec from '../../ui/sims/paladin/holy/spec';
import protectionPaladinSpec from '../../ui/sims/paladin/protection/spec';
import retributionPaladinSpec from '../../ui/sims/paladin/retribution/spec';
import disciplinePriestSpec from '../../ui/sims/priest/discipline/spec';
import holyPriestSpec from '../../ui/sims/priest/holy/spec';
import shadowPriestSpec from '../../ui/sims/priest/shadow/spec';
import assassinationRogueSpec from '../../ui/sims/rogue/assassination/spec';
import combatRogueSpec from '../../ui/sims/rogue/combat/spec';
import subtletyRogueSpec from '../../ui/sims/rogue/subtlety/spec';
import elementalShamanSpec from '../../ui/sims/shaman/elemental/spec';
import enhancementShamanSpec from '../../ui/sims/shaman/enhancement/spec';
import restorationShamanSpec from '../../ui/sims/shaman/restoration/spec';
import afflictionWarlockSpec from '../../ui/sims/warlock/affliction/spec';
import demonologyWarlockSpec from '../../ui/sims/warlock/demonology/spec';
import destructionWarlockSpec from '../../ui/sims/warlock/destruction/spec';
import armsWarriorSpec from '../../ui/sims/warrior/arms/spec';
import furyWarriorSpec from '../../ui/sims/warrior/fury/spec';
import protectionWarriorSpec from '../../ui/sims/warrior/protection/spec';
import { makeMemoryEnv } from './memory_env';

registerSpecConfig(armsWarriorSpec.spec, armsWarriorSpec);
registerSpecConfig(bloodDeathKnightSpec.spec, bloodDeathKnightSpec);
registerSpecConfig(frostDeathKnightSpec.spec, frostDeathKnightSpec);
registerSpecConfig(unholyDeathKnightSpec.spec, unholyDeathKnightSpec);
registerSpecConfig(balanceDruidSpec.spec, balanceDruidSpec);
registerSpecConfig(feralDruidSpec.spec, feralDruidSpec);
registerSpecConfig(guardianDruidSpec.spec, guardianDruidSpec);
registerSpecConfig(restorationDruidSpec.spec, restorationDruidSpec);
registerSpecConfig(beastMasteryHunterSpec.spec, beastMasteryHunterSpec);
registerSpecConfig(marksmanshipHunterSpec.spec, marksmanshipHunterSpec);
registerSpecConfig(survivalHunterSpec.spec, survivalHunterSpec);
registerSpecConfig(arcaneMageSpec.spec, arcaneMageSpec);
registerSpecConfig(fireMageSpec.spec, fireMageSpec);
registerSpecConfig(frostMageSpec.spec, frostMageSpec);
registerSpecConfig(brewmasterMonkSpec.spec, brewmasterMonkSpec);
registerSpecConfig(mistweaverMonkSpec.spec, mistweaverMonkSpec);
registerSpecConfig(windwalkerMonkSpec.spec, windwalkerMonkSpec);
registerSpecConfig(holyPaladinSpec.spec, holyPaladinSpec);
registerSpecConfig(protectionPaladinSpec.spec, protectionPaladinSpec);
registerSpecConfig(retributionPaladinSpec.spec, retributionPaladinSpec);
registerSpecConfig(holyPriestSpec.spec, holyPriestSpec);
registerSpecConfig(shadowPriestSpec.spec, shadowPriestSpec);
registerSpecConfig(elementalShamanSpec.spec, elementalShamanSpec);
registerSpecConfig(enhancementShamanSpec.spec, enhancementShamanSpec);
registerSpecConfig(restorationShamanSpec.spec, restorationShamanSpec);
registerSpecConfig(afflictionWarlockSpec.spec, afflictionWarlockSpec);
registerSpecConfig(demonologyWarlockSpec.spec, demonologyWarlockSpec);
registerSpecConfig(destructionWarlockSpec.spec, destructionWarlockSpec);
registerSpecConfig(furyWarriorSpec.spec, furyWarriorSpec);
registerSpecConfig(protectionWarriorSpec.spec, protectionWarriorSpec);
registerSpecConfig(disciplinePriestSpec.spec, disciplinePriestSpec);
registerSpecConfig(assassinationRogueSpec.spec, assassinationRogueSpec);
registerSpecConfig(combatRogueSpec.spec, combatRogueSpec);
registerSpecConfig(subtletyRogueSpec.spec, subtletyRogueSpec);

// Mirror of IndividualSimUI.applyDefaults (individual_sim_ui.tsx) without the
// UI-owned satellites (reforger, statWeightActionSettings, defaultBuild).
// When the defaults logic moves into ui/domain/state/, replace this mirror with
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
