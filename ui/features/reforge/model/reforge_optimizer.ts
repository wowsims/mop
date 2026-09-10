// DOM-free half of the reforge optimizer: settings access, EP / soft-cap math and
// the solve itself (cache lookup, sim request, abort). The rendering half lives in
// ../components/ReforgePanel and owns every button, tooltip, toast and modal.
import { isDevMode } from '@sim/utils/env';
import { Player } from '@sim/player/player';
import { Gear } from '@sim/proto/gear';
import { getReforgeCacheGearKey } from '@sim/proto/items';
import { StatCap, Stats, UnitStatPresets } from '@sim/proto/stats';
import { ReforgeGearCache } from '@sim/cache/reforge_cache';
import { ReforgeSettings as ReforgeSettingsState } from '@sim/settings/reforge_settings';
import type { ReforgeOptimizeConfig, Sim } from '@sim/sim';
import { RequestTypes } from '@sim/sim_signal_manager';
import type { IndividualSimUIConfig } from '@sim/spec_config';
import { getReforgeConfigHash, makeReforgeConfigRequestFields } from '@sim/state/reforge_request';
import { subscribeAll, subscribePlayerField, subscribeReforgeField } from '@sim/state/subscriptions';
import { ReforgeOptimizeRequest, ReforgeSettings } from '@generated/proto/api';
import { Spec, Stat } from '@generated/proto/common';
import { SimRunKind } from '@sim/state/sim_store';

import { applyBreakpointLimits, clearSoftCappedStats } from './utils';

// Opaque here on purpose: these are rendered by ReforgePanel and this layer is framework-free
// (see ui/README.md dependency direction), so it cannot name `ReactNode`.
export type StatTooltipContent = { [key in Stat]?: () => unknown };

// Handed to the option callbacks below so a spec config can reach the reforger and
// its own defaults without closing over the sim UI instance.
export type ReforgeOptimizerContext = {
	player: Player<any>;
	reforger: ReforgeOptimizerModel;
	defaults: IndividualSimUIConfig<any>['defaults'];
};

export type ReforgeOptimizerOptions = {
	statTooltips?: StatTooltipContent;
	statSelectionPresets?: UnitStatPresets[];
	// Allows you to enable breakpoint limits for Treshold type caps
	enableBreakpointLimits?: boolean;
	// Allows you to get alternate default EPs
	// For example for Fury where you have SMF and TG EPs
	getEPDefaults?: (player: Player<any>, ctx: ReforgeOptimizerContext) => Stats;
	// Allows you to modify default softCaps
	// For example you wish to add breakpoints for Berserking / Bloodlust if enabled
	updateSoftCaps?: (softCaps: StatCap[], player: Player<any>, ctx: ReforgeOptimizerContext) => StatCap[];
	// Allows you to specifiy additional information for the soft cap tooltips
	additionalSoftCapTooltipInformation?: StatTooltipContent;
	// Sets the default stat to be the highest for relative stat cap calculations
	// Defaults to Any
	defaultRelativeStatCap?: Stat | null;
};

// The spec-config values the model needs; the view reads them off `IndividualSimHost`.
export type ReforgeOptimizerModelOptions = ReforgeOptimizerOptions & {
	defaults: IndividualSimUIConfig<any>['defaults'];
	epStats: Stat[];
};

// Everything outside this module reaches the optimizer through this shape. Per-field settings
// writes are not on it: `settings` is the store-backed facade and takes them directly.
export interface ReforgeOptimizerModel {
	readonly settings: ReforgeSettingsState;
	readonly defaults: IndividualSimUIConfig<any>['defaults'];
	readonly enableBreakpointLimits: boolean;
	readonly statSelectionPresets: UnitStatPresets[] | undefined;
	/** The gear a solve started from — the diff toast reads it, and an error or cancel restores it. */
	readonly previousGear: Gear | null;
	readonly softCapsConfig: StatCap[];
	readonly softCapsConfigWithLimits: StatCap[];
	readonly preCapEPs: Stats;
	readonly isAllowedToOverrideStatCaps: boolean;
	readonly statCaps: Stats;
	setUseSoftCapBreakpoints(newValue: boolean): void;
	setIncludeGems(newValue: boolean): void;
	setIncludeEOTBPGemSocket(newValue: boolean): void;
	getReforgeOptimizeConfig(gear: Gear): ReforgeOptimizeConfig;
	optimizeReforges(gear?: Gear): Promise<Gear>;
	abortReforgeOptimization(): Promise<void>;
	fromProto(proto: ReforgeSettings): void;
	applyDefaults(): void;
}

const HYBRID_CASTER_SPECS = [Spec.SpecBalanceDruid, Spec.SpecShadowPriest, Spec.SpecElementalShaman, Spec.SpecMistweaverMonk];

export const createReforgeOptimizer = (sim: Sim, player: Player<any>, options: ReforgeOptimizerModelOptions): ReforgeOptimizerModel => {
	const { defaults, epStats, getEPDefaults, updateSoftCaps, statSelectionPresets } = options;
	const enableBreakpointLimits = !!options.enableBreakpointLimits;
	const isHybridCaster = HYBRID_CASTER_SPECS.includes(player.getSpec());
	const baseSoftCaps = defaults.softCapBreakpoints || [];
	const settings = new ReforgeSettingsState(player, defaults, options.defaultRelativeStatCap);
	let previousGear: Gear | null = null;

	const softCapsConfig = () => updateSoftCaps?.(StatCap.cloneSoftCaps(baseSoftCaps), player, ctx) || baseSoftCaps;

	const softCapsConfigWithLimits = () =>
		!enableBreakpointLimits || !settings.useSoftCapBreakpoints ? softCapsConfig() : applyBreakpointLimits(softCapsConfig(), settings.breakpointLimits);

	const preCapEPs = () => {
		let weights = player.getEpWeights();

		if (!settings.useCustomEPValues) {
			if (getEPDefaults) {
				weights = getEPDefaults(player, ctx);
			} else if (player.hasCustomEPWeights()) {
				weights = defaults.epWeights;
			}
		}

		// Replace Spirit EP for hybrid casters with a small value in order to break ties between Spirit and Hit Reforges
		if (isHybridCaster) {
			weights = weights.withStat(Stat.StatSpirit, 0.01);
		}

		return weights;
	};

	// `softCapsConfig()` is always an array and so always truthy; this reads as `!useSoftCapBreakpoints` today.
	const isAllowedToOverrideStatCaps = () => !(settings.useSoftCapBreakpoints && softCapsConfig());

	const getReforgeOptimizeConfig = (gear: Gear): ReforgeOptimizeConfig => {
		const proto = settings.toProto();
		const softCaps = softCapsConfigWithLimits();
		proto.statCaps = (isAllowedToOverrideStatCaps() ? settings.statCaps : clearSoftCappedStats(settings.statCaps, softCaps)).toProto();
		proto.epStats = epStats.slice();

		return {
			gear,
			preCapEPWeights: preCapEPs(),
			undershootCaps: settings.undershootCaps,
			settings: proto,
			softCaps,
		};
	};

	const runReforgeOptimization = async (gear?: Gear) => {
		if (isDevMode()) console.log('Starting Reforge optimization...');
		previousGear = gear || player.getGear();

		const config = getReforgeOptimizeConfig(previousGear);
		const cache = ReforgeGearCache.get(player.getPlayerSpec(), player.sim.env);
		const configHash = await getReforgeConfigHash({
			player,
			// THE cache-key contract for the 14-day reforge cache. `makeReforgeConfigRequestFields` declares
			// exactly which player/request state a solve depends on; when a new field that affects solve
			// output is added to Player or ReforgeOptimizeRequest, it must be reflected there or stale
			// reforges are served silently - and an irrelevant field left in busts every user's cache on
			// unrelated changes. Raid and gear are excluded: those are separate components of the key.
			reforgeRequest: ReforgeOptimizeRequest.create({ ...makeReforgeConfigRequestFields(config, sim.db) }),
			raidBuffs: sim.raid.getBuffs(),
			partyBuffs: player.getParty()?.getBuffs(),
			debuffs: sim.raid.getDebuffs(),
		});
		const frozenItemSlots = config.settings.freezeItemSlots && config.settings.frozenItemSlots.length ? config.settings.frozenItemSlots : undefined;
		// Existing gems must be part of the cache key whether or not includeGems is set: with it off
		// the optimizer keeps the equipped gems, and with it on minimizeRegems reuses them. Either
		// way the optimized gear depends on the equipped gems, so dropping them returns stale gear.
		const cacheKey = ReforgeGearCache.getKey(getReforgeCacheGearKey(previousGear.asSpec(), frozenItemSlots), configHash);
		const cachedGear = await cache.get(cacheKey);
		if (cachedGear) {
			if (isDevMode()) console.log('Reforge optimization: cache hit.');
			return sim.db.lookupEquipmentSpec(cachedGear);
		}

		const result = await sim.reforgeOptimize(config);
		if (!result.optimizedGear) {
			throw new Error('Native Go reforge optimizer did not return optimized gear.');
		}

		await cache.setGear(cacheKey, result.optimizedGear);

		return sim.db.lookupEquipmentSpec(result.optimizedGear);
	};

	const model: ReforgeOptimizerModel = {
		settings,
		defaults,
		enableBreakpointLimits,
		statSelectionPresets,
		get previousGear() {
			return previousGear;
		},
		get softCapsConfig() {
			return softCapsConfig();
		},
		get softCapsConfigWithLimits() {
			return softCapsConfigWithLimits();
		},
		get preCapEPs() {
			return preCapEPs();
		},
		get isAllowedToOverrideStatCaps() {
			return isAllowedToOverrideStatCaps();
		},
		get statCaps() {
			return settings.statCaps;
		},
		setUseSoftCapBreakpoints: newValue => settings.setUseSoftCapBreakpoints(newValue),
		setIncludeGems: newValue => settings.setIncludeGems(newValue),
		setIncludeEOTBPGemSocket: newValue => settings.setIncludeEOTBPGemSocket(newValue),
		getReforgeOptimizeConfig,
		optimizeReforges: gear => sim.runs.start(SimRunKind.ReforgeOptimize, () => runReforgeOptimization(gear)),
		// Left unconditional rather than routed through `SimRuns.abort`: bulk's pre-pass registers under
		// this type without going through `start`, so a store-gated abort would silently miss it.
		abortReforgeOptimization: async () => {
			await sim.signalManager.abortType(RequestTypes.ReforgeOptimize);
		},
		fromProto: proto => settings.fromProto(proto),
		applyDefaults: () => settings.applyDefaults(),
	};

	// Closes the loop the option callbacks need; they only read it once a spec option runs.
	const ctx: ReforgeOptimizerContext = { player, reforger: model, defaults };

	subscribeAll([
		subscribeReforgeField(settings, 'useCustomEPValues'),
		subscribePlayerField(player, 'epWeights'),
		subscribeReforgeField(settings, 'statCaps'),
	])(() => {
		if (settings.useCustomEPValues && (player.hasCustomEPWeights() || !settings._statCaps.equals(defaults.statCaps || new Stats()))) {
			settings.setUseSoftCapBreakpoints(false);
		}
	});

	subscribePlayerField(
		player,
		'gear',
	)(() => {
		settings.setRelativeStatCap(settings.relativeStatCapStat);
	});

	return model;
};
