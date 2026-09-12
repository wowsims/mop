import { APLRotation, APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import { Cooldowns, Glyphs, ItemSwap, Profession, type Spec } from '@generated/proto/common';
import type { Player } from '@sim/player/player';
import type { StatWeightActionSettings } from '@sim/settings/stat_weight_settings';
import type { IndividualSimHost } from '@sim/sim_host';
import type { IndividualSimUIConfig } from '@sim/spec_config';
import { batch } from '@sim/state/batch';

import { applyBuild } from './apply_build';

export type DefaultsHost<SpecType extends Spec> = IndividualSimHost<SpecType> & { readonly statWeightActionSettings: StatWeightActionSettings };

export function applyDefaultRotation<SpecType extends Spec>(player: Player<SpecType>, config: IndividualSimUIConfig<SpecType>) {
	batch(() => {
		const defaultRotationType = config.defaults.rotationType || APLRotationType.TypeAuto;
		player.setAplRotation(
			APLRotation.create({
				type: defaultRotationType,
			}),
		);

		if (!config.defaults.simpleRotation) {
			return;
		}

		const defaultSimpleRotation = config.defaults.simpleRotation || player.specTypeFunctions.rotationCreate();
		player.setSimpleRotation(defaultSimpleRotation);
		player.setSimpleCooldowns(
			Cooldowns.create({
				hpPercentForDefensives: player.playerSpec.isTankSpec ? 0.4 : 0,
			}),
		);
	});
}

export function applyEmptyAplRotation<SpecType extends Spec>(player: Player<SpecType>) {
	batch(() => {
		player.setAplRotation(
			APLRotation.create({
				type: APLRotationType.TypeAPL,
			}),
		);
	});
}

// `host` rather than its parts: this runs from the persistence load queued on the first
// `waitForInit()`, by which time the constructor has set `reforger` — capturing it up front
// would silently skip the reforge defaults.
export function applyIndividualDefaults<SpecType extends Spec>(host: DefaultsHost<SpecType>) {
	const { player, sim, individualConfig: config } = host;
	batch(() => {
		const tankSpec = player.getPlayerSpec().isTankSpec;
		const healingSpec = player.getPlayerSpec().isHealingSpec;

		player.applySharedDefaults();
		player.setRace(config.defaults.other?.race || player.getPlayerClass().races[0]);
		player.setGear(sim.db.lookupEquipmentSpec(config.defaults.gear));
		player.setConsumes(config.defaults.consumables);
		applyDefaultRotation(player, config);
		player.setTalentsString(config.defaults.talents.talentsString);
		player.setGlyphs(config.defaults.talents.glyphs || Glyphs.create());
		player.setSpecOptions(config.defaults.specOptions);
		player.setBuffs(config.defaults.individualBuffs);
		player.getParty()!.setBuffs(config.defaults.partyBuffs);
		player.getRaid()!.setBuffs(config.defaults.raidBuffs);
		player.setEpWeights(config.defaults.epWeights);
		if (config.defaults.itemSwap) {
			player.itemSwapSettings.setItemSwapSettings(true, sim.db.lookupItemSwap(config.defaults.itemSwap || ItemSwap.create()));
		}

		const defaultRatios = player.getDefaultEpRatios(tankSpec, healingSpec);
		player.setEpRatios(defaultRatios);
		player.setProfession1(config.defaults.other?.profession1 || Profession.Engineering);

		if (config.defaults.other?.profession2 === undefined) {
			player.setProfession2(Profession.Jewelcrafting);
		} else {
			player.setProfession2(config.defaults.other.profession2);
		}

		player.setDistanceFromTarget(config.defaults.other?.distanceFromTarget || 0);
		player.setChannelClipDelay(config.defaults.other?.channelClipDelay || 0);
		player.setReactionTime(config.defaults.other?.reactionTime || 100);

		host.reforger?.applyDefaults();

		sim.raid.setTargetDummies(healingSpec ? 9 : 0);
		if (config.defaults.encounter?.encounter) {
			sim.encounter.fromProto(config.defaults.encounter.encounter);
		} else {
			sim.encounter.applyDefaults();
		}
		sim.encounter.setExecuteProportion90(config.defaults.other?.highHpThreshold || 0.9);
		sim.raid.setDebuffs(config.defaults.debuffs);
		sim.applyDefaults(tankSpec, healingSpec);

		if (config.defaults.other?.iterationCount) {
			sim.setIterations(config.defaults.other!.iterationCount!);
		}

		if (tankSpec) {
			sim.raid.setTanks([player.makeUnitReference()]);
		} else {
			sim.raid.setTanks([]);
		}

		host.statWeightActionSettings.applyDefaults();

		if (config.defaultBuild) {
			applyBuild(config.defaultBuild, host);
		}
	});
}
