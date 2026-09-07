// Reforge-solve request/cache-key helpers, extracted from the ReforgeOptimizer
// component so the domain layer (sim.ts, bulk sim, reforge cache) does not
// depend on ui/core/components.
import { Player as PlayerProtoMessageType, ReforgeOptimizeMode, ReforgeOptimizeRequest, ReforgeSettings } from '@generated/proto/api';
import { Debuffs, GemColor, ItemQuality, PartyBuffs, Profession, RaidBuffs } from '@generated/proto/common';
import { UIGem as Gem } from '@generated/proto/ui';

import { distinct } from '../collections';
import { SimSettingCategories } from '../constants/sim_settings';
import type { Player } from '../player';
import { Database } from '../proto_utils/database';
import { ReforgeGearCache } from '../reforge_cache';
import type { ReforgeOptimizeConfig } from '../sim';

// The player state a reforge solve depends on: the listed setting categories, plus bonus
// stats and item-swap config, minus fields that are either keyed separately (equipment),
// derivable (database), or irrelevant to a solve.
function cacheRelevantPlayerProto(player: Player<any>): PlayerProtoMessageType {
	const playerProto = player.toProto(true, false, [
		SimSettingCategories.Talents,
		SimSettingCategories.Consumes,
		SimSettingCategories.External,
		SimSettingCategories.Miscellaneous,
	]);
	playerProto.bonusStats = player.getBonusStats().toProto();
	playerProto.enableItemSwap = player.itemSwapSettings.getEnableItemSwap();
	playerProto.itemSwap = player.itemSwapSettings.toProto();
	playerProto.equipment = undefined;
	playerProto.database = undefined;
	playerProto.channelClipDelayMs = 0;
	playerProto.inFrontOfTarget = false;
	playerProto.distanceFromTarget = 0;
	playerProto.healingModel = undefined;
	return playerProto;
}

// The optimizer config a solve depends on: everything except per-run identity
// (requestId, debug, mode) and the raid, which is keyed separately. Gem options are
// order-normalized so equal sets hash equally.
export function cacheRelevantReforgeRequest(reforgeRequest: ReforgeOptimizeRequest): ReforgeOptimizeRequest {
	const configForHash = ReforgeOptimizeRequest.clone({ ...reforgeRequest, raid: undefined } as ReforgeOptimizeRequest);
	configForHash.requestId = '';
	configForHash.debug = false;
	configForHash.mode = ReforgeOptimizeMode.ReforgeOptimizeModeSingle;
	configForHash.gemOptions = configForHash.gemOptions.sort((a, b) => a.id - b.id);
	return configForHash;
}

export async function getReforgeConfigHash({
	player,
	reforgeRequest,
	raidBuffs,
	partyBuffs,
	debuffs,
}: {
	player: Player<any>;
	reforgeRequest: ReforgeOptimizeRequest;
	raidBuffs: RaidBuffs;
	partyBuffs: PartyBuffs | undefined;
	debuffs: Debuffs;
}): Promise<string> {
	return ReforgeGearCache.getHash({
		player: PlayerProtoMessageType.toJsonString(cacheRelevantPlayerProto(player)),
		raid: {
			buffs: RaidBuffs.toJsonString(raidBuffs),
			partyBuffs: partyBuffs ? PartyBuffs.toJsonString(partyBuffs) : null,
			debuffs: Debuffs.toJsonString(debuffs),
		},
		optimizer: ReforgeOptimizeRequest.toJsonString(cacheRelevantReforgeRequest(reforgeRequest)),
	});
}

export function getReforgeGemOptions(db: Database, settings: ReforgeSettings): Gem[] {
	return settings.includeGems
		? distinct(
				[
					GemColor.GemColorPrismatic,
					GemColor.GemColorShaTouched,
					GemColor.GemColorCogwheel,
					GemColor.GemColorRed,
					GemColor.GemColorBlue,
					GemColor.GemColorYellow,
				]
					.flatMap(socketColor => db.getGems(socketColor))
					.filter(gem => !gem.name.includes('Perfect') && gem.quality >= ItemQuality.ItemQualityRare)
					.flat(),
				(a, b) => a.id == b.id,
			)
		: [];
}

export function makeReforgeConfigRequestFields(config: ReforgeOptimizeConfig, db: Database) {
	return {
		preCapEpWeights: config.preCapEPWeights.toProto(),
		undershootCaps: config.undershootCaps.toProto(),
		settings: config.settings,
		softCaps: config.softCaps.map(softCap => ({
			unitStat: softCap.unitStat.toProto(),
			breakpoints: softCap.breakpoints.slice(),
			capType: softCap.capType,
			postCapEPs: softCap.postCapEPs.slice(),
		})),
		gemOptions: getReforgeGemOptions(db, config.settings).map(gem => ({
			id: gem.id,
			name: gem.name,
			icon: gem.icon,
			color: gem.color,
			stats: gem.stats.slice(),
			phase: gem.phase,
			quality: gem.quality ?? ItemQuality.ItemQualityJunk,
			unique: gem.unique,
			requiredProfession: gem.requiredProfession ?? Profession.ProfessionUnknown,
			disabledInChallengeMode: gem.disabledInChallengeMode,
		})),
	};
}
