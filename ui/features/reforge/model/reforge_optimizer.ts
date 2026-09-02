// DOM-free half of the reforge optimizer: settings access, EP / soft-cap math and
// the solve itself (cache lookup, sim request, abort). The rendering half lives in
// ../view/reforge_panel.tsx and owns every button, tooltip, toast and modal.
import { ReforgeOptimizeRequest, ReforgeSettings, StatCapType } from '@core/proto/api';
import { Class, ItemSlot, Spec, Stat } from '@core/proto/common';
import * as Mechanics from '@domain/constants/mechanics';
import { Player } from '@domain/player';
import { Gear } from '@domain/proto_utils/gear';
import { StatCap, Stats, UnitStat, UnitStatPresets } from '@domain/proto_utils/stats';
import { getReforgeCacheGearKey } from '@domain/proto_utils/utils';
import { ReforgeGearCache } from '@domain/reforge_cache';
import { ReforgeSettings as ReforgeSettingsState } from '@domain/reforge_settings';
import type { ReforgeOptimizeConfig, Sim } from '@domain/sim';
import { RequestTypes } from '@domain/sim_signal_manager';
import { EventID, nextEventID } from '@domain/state/batch';
import { getReforgeConfigHash, makeReforgeConfigRequestFields } from '@domain/state/reforge_request';
import { subscribeAll, subscribePlayerField, subscribeReforgeField } from '@domain/state/subscriptions';
import { isDevMode } from '@domain/utils';
import type { IndividualSimUIConfig } from '@features/spec_config';

export type StatTooltipContent = { [key in Stat]?: () => Element | string };

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

export class ReforgeOptimizerModel {
	readonly sim: Sim;
	readonly player: Player<any>;
	readonly playerClass: Class;
	readonly isHybridCaster: boolean;
	readonly isTankSpec: boolean;
	readonly defaults: IndividualSimUIConfig<any>['defaults'];
	readonly settings: ReforgeSettingsState;
	readonly ctx: ReforgeOptimizerContext;
	readonly enableBreakpointLimits: boolean;
	readonly statSelectionPresets: ReforgeOptimizerOptions['statSelectionPresets'];
	previousGear: Gear | null = null;
	protected readonly epStats: Stat[];
	protected getEPDefaults: ReforgeOptimizerOptions['getEPDefaults'];
	protected updateSoftCaps: ReforgeOptimizerOptions['updateSoftCaps'];
	protected _softCapsConfig: StatCap[];

	constructor(sim: Sim, player: Player<any>, options: ReforgeOptimizerModelOptions) {
		this.sim = sim;
		this.player = player;
		this.playerClass = this.player.getClass();
		this.isHybridCaster = [Spec.SpecBalanceDruid, Spec.SpecShadowPriest, Spec.SpecElementalShaman, Spec.SpecMistweaverMonk].includes(this.player.getSpec());
		this.isTankSpec = this.player.getPlayerSpec().isTankSpec;
		this.defaults = options.defaults;
		this.epStats = options.epStats;
		this.getEPDefaults = options.getEPDefaults;
		this.updateSoftCaps = options.updateSoftCaps;
		this._softCapsConfig = this.defaults.softCapBreakpoints || [];
		this.statSelectionPresets = options.statSelectionPresets;
		this.enableBreakpointLimits = !!options.enableBreakpointLimits;
		this.settings = new ReforgeSettingsState(this.player, this.defaults, options.defaultRelativeStatCap);
		this.ctx = { player: this.player, reforger: this, defaults: this.defaults };

		subscribeAll([
			subscribeReforgeField(this.settings, 'useCustomEPValues'),
			subscribePlayerField(this.player, 'epWeights'),
			subscribeReforgeField(this.settings, 'statCaps'),
		])(() => {
			if (
				this.settings.useCustomEPValues &&
				(this.player.hasCustomEPWeights() || !this.settings._statCaps.equals(this.defaults.statCaps || new Stats()))
			) {
				this.setUseSoftCapBreakpoints(nextEventID(), false);
			}
		});

		subscribePlayerField(
			this.player,
			'gear',
		)(() => {
			this.setRelativeStatCap(nextEventID(), this.settings.relativeStatCapStat);
		});
	}

	get softCapsConfig() {
		return this.updateSoftCaps?.(StatCap.cloneSoftCaps(this._softCapsConfig), this.player, this.ctx) || this._softCapsConfig;
	}

	get softCapsConfigWithLimits() {
		if (!this.enableBreakpointLimits || !this.settings.useSoftCapBreakpoints) return this.softCapsConfig;

		const softCaps = StatCap.cloneSoftCaps(this.softCapsConfig);
		for (const [unitStat, limit] of this.settings.breakpointLimits.asUnitStatArray()) {
			if (!limit) continue;
			// A stat can have multiple configs (e.g. a SoftCap and a Threshold for the same stat), so apply the
			// limit to whichever config actually owns that breakpoint rather than just the first matching stat.
			for (const config of softCaps) {
				if (!config.unitStat.equals(unitStat) || !config.breakpoints.some(breakpoint => breakpoint == limit)) continue;
				config.breakpoints = config.breakpoints.filter(breakpoint => breakpoint <= limit);
				if (config.capType === StatCapType.TypeSoftCap) {
					config.postCapEPs = config.postCapEPs.slice(0, config.breakpoints.length);
				}
			}
		}
		return softCaps;
	}

	get preCapEPs(): Stats {
		let weights = this.player.getEpWeights();

		if (!this.settings.useCustomEPValues) {
			if (this.getEPDefaults) {
				weights = this.getEPDefaults?.(this.player, this.ctx);
			} else if (this.player.hasCustomEPWeights()) {
				weights = this.defaults.epWeights;
			}
		}

		// Replace Spirit EP for hybrid casters with a small value in order to break ties between Spirit and Hit Reforges
		if (this.isHybridCaster) {
			weights = weights.withStat(Stat.StatSpirit, 0.01);
		}

		return weights;
	}

	// Settings API — delegates to this.settings (ui/domain/reforge_settings.ts).
	setStatCaps(eventID: EventID, newStatCaps: Stats) {
		this.settings.setStatCaps(eventID, newStatCaps);
	}

	get statCaps() {
		return this.settings.statCaps;
	}

	setUseCustomEPValues(eventID: EventID, newUseCustomEPValues: boolean) {
		this.settings.setUseCustomEPValues(eventID, newUseCustomEPValues);
	}

	setUseSoftCapBreakpoints(eventID: EventID, newUseSoftCapBreakpoints: boolean) {
		this.settings.setUseSoftCapBreakpoints(eventID, newUseSoftCapBreakpoints);
	}

	setBreakpointLimits(eventID: EventID, newLimits: Stats) {
		this.settings.setBreakpointLimits(eventID, newLimits);
	}

	setRelativeStatCap(eventID: EventID, newValue: number) {
		this.settings.setRelativeStatCap(eventID, newValue);
	}
	setRelativeStatCapPrecision(eventID: EventID, newValue: number) {
		this.settings.setRelativeStatCapPrecision(eventID, newValue);
	}

	setIncludeGems(eventID: EventID, newValue: boolean) {
		this.settings.setIncludeGems(eventID, newValue);
	}

	setIncludeEOTBPGemSocket(eventID: EventID, newValue: boolean) {
		this.settings.setIncludeEOTBPGemSocket(eventID, newValue);
	}

	setFreezeItemSlots(eventID: EventID, newValue: boolean) {
		this.settings.setFreezeItemSlots(eventID, newValue);
	}

	setFrozenItemSlot(eventID: EventID, slot: ItemSlot, frozen: boolean) {
		this.settings.setFrozenItemSlot(eventID, slot, frozen);
	}

	getFrozenItemSlot(slot: ItemSlot): boolean {
		return this.settings.getFrozenItemSlot(slot);
	}

	get isAllowedToOverrideStatCaps() {
		return !(this.settings.useSoftCapBreakpoints && this.softCapsConfig);
	}

	get processedStatCaps() {
		let statCaps = this.statCaps;
		if (!this.isAllowedToOverrideStatCaps)
			this.softCapsConfigWithLimits.forEach(({ unitStat }) => {
				statCaps = statCaps.withUnitStat(unitStat, 0);
			});

		return statCaps;
	}

	getReforgeOptimizeConfig(gear: Gear): ReforgeOptimizeConfig {
		const settings = this.toProto();
		settings.statCaps = this.processedStatCaps.toProto();
		settings.epStats = this.epStats.slice();

		return {
			gear,
			preCapEPWeights: this.preCapEPs,
			undershootCaps: this.settings.undershootCaps,
			settings,
			softCaps: this.softCapsConfigWithLimits,
		};
	}

	// THE cache-key contract for the 14-day reforge cache. The two functions below declare
	// exactly which player/request state a solve depends on; when a new field that affects
	// solve output is added to Player or ReforgeOptimizeRequest, it must be reflected here or
	// stale reforges are served silently - and an irrelevant field left in busts every
	// user's cache on unrelated changes.

	// Builds the ReforgeOptimizeRequest used as the config portion of the cache key.
	// Excludes raid and gear — those are separate components of the cache key.
	getReforgeRequestForHash(config: ReforgeOptimizeConfig): ReforgeOptimizeRequest {
		return ReforgeOptimizeRequest.create({
			...makeReforgeConfigRequestFields(config, this.sim.db),
		});
	}

	async optimizeReforges(gear?: Gear) {
		if (isDevMode()) console.log('Starting Reforge optimization...');
		const previousGear = gear || this.player.getGear();
		this.previousGear = previousGear;

		const config = this.getReforgeOptimizeConfig(previousGear);
		const cache = ReforgeGearCache.get(this.player.getPlayerSpec(), this.player.sim.env);
		const configHash = await getReforgeConfigHash({
			player: this.player,
			reforgeRequest: this.getReforgeRequestForHash(config),
			raidBuffs: this.sim.raid.getBuffs(),
			partyBuffs: this.player.getParty()?.getBuffs(),
			debuffs: this.sim.raid.getDebuffs(),
		});
		const frozenItemSlots = config.settings.freezeItemSlots && config.settings.frozenItemSlots.length ? config.settings.frozenItemSlots : undefined;
		// Existing gems must be part of the cache key whether or not includeGems is set: with it off
		// the optimizer keeps the equipped gems, and with it on minimizeRegems reuses them. Either
		// way the optimized gear depends on the equipped gems, so dropping them returns stale gear.
		const cacheKey = ReforgeGearCache.getKey(getReforgeCacheGearKey(previousGear.asSpec(), frozenItemSlots), configHash);
		const cachedGear = await cache.get(cacheKey);
		if (cachedGear) {
			if (isDevMode()) console.log('Reforge optimization: cache hit.');
			return this.sim.db.lookupEquipmentSpec(cachedGear);
		}

		const result = await this.sim.reforgeOptimize(config);
		if (!result.optimizedGear) {
			throw new Error('Native Go reforge optimizer did not return optimized gear.');
		}

		await cache.setGear(cacheKey, result.optimizedGear);

		return this.sim.db.lookupEquipmentSpec(result.optimizedGear);
	}

	toVisualUnitStatPercentage(statValue: number, unitStat: UnitStat) {
		const rawStatValue = statValue;
		let percentOrPointsValue = unitStat.convertDefaultUnitsToPercent(rawStatValue)!;
		if (unitStat.equalsStat(Stat.StatMasteryRating)) {
			const baseMastery = this.player.getBaseMastery() * Mechanics.MASTERY_RATING_PER_MASTERY_POINT;
			percentOrPointsValue = rawStatValue - baseMastery <= 0 ? 0 : percentOrPointsValue * this.player.getMasteryPerPointModifier();
		}

		return percentOrPointsValue;
	}

	toDefaultUnitStatValue(value: number, unitStat: UnitStat) {
		let statValue = unitStat.convertPercentToDefaultUnits(value)!;
		if (unitStat.equalsStat(Stat.StatMasteryRating)) statValue /= this.player.getMasteryPerPointModifier();
		return statValue;
	}

	breakpointValueToDisplayPercentage(value: number, unitStat: UnitStat) {
		return unitStat.equalsStat(Stat.StatMasteryRating)
			? ((value / Mechanics.MASTERY_RATING_PER_MASTERY_POINT) * this.player.getMasteryPerPointModifier()).toFixed(2)
			: unitStat.convertDefaultUnitsToPercent(value)!.toFixed(2);
	}

	async abortReforgeOptimization() {
		await this.sim.signalManager.abortType(RequestTypes.ReforgeOptimize);
	}

	fromProto(eventID: EventID, proto: ReforgeSettings) {
		this.settings.fromProto(eventID, proto);
	}

	toProto(): ReforgeSettings {
		return this.settings.toProto();
	}

	applyDefaults(eventID: EventID) {
		this.settings.applyDefaults(eventID);
	}
}
