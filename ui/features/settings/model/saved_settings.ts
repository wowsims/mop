import { Stats } from '@domain/proto_utils/stats';
import { batch } from '@domain/state/batch';
import type { IndividualSimHost } from '@features/sim_host';
import { ConsumesSpec, Debuffs, HealingModel, IndividualBuffs, ItemSwap, PartyBuffs, RaidBuffs } from '@generated/proto/common';
import { SavedSettings } from '@generated/proto/ui';

/**
 * Everything the "Saved Settings" manager stores, read off the live sim.
 *
 * Both halves lived on `SettingsTab` and are pure state: one reads, one writes. They are here so the
 * tab can become a view — and because `readSavedSettings` already has two callers, the manager's
 * `getData` and the preset item-swap list, which bakes a load-time snapshot into each entry.
 */
export const readSavedSettings = (host: IndividualSimHost<any>): SavedSettings =>
	SavedSettings.create({
		raidBuffs: host.sim.raid.getBuffs(),
		partyBuffs: host.player.getParty()?.getBuffs() || PartyBuffs.create(),
		playerBuffs: host.player.getBuffs(),
		debuffs: host.sim.raid.getDebuffs(),
		consumables: host.player.getConsumes(),
		race: host.player.getRace(),
		professions: host.player.getProfessions(),
		enableItemSwap: host.player.itemSwapSettings.getEnableItemSwap(),
		itemSwap: host.player.itemSwapSettings.toProto(),
		reactionTimeMs: host.player.getReactionTime(),
		channelClipDelayMs: host.player.getChannelClipDelay(),
		inFrontOfTarget: host.player.getInFrontOfTarget(),
		distanceFromTarget: host.player.getDistanceFromTarget(),
		healingModel: host.player.getHealingModel(),
		challengeMode: host.player.getChallengeModeEnabled(),
	});

/**
 * Applies a saved settings entry, in one batch so the fourteen writes land as a single notification.
 *
 * Every `|| X.create()` is load-bearing rather than defensive: proto3 omits an empty message, so a
 * saved entry that had no debuffs comes back with the field absent, and the setter needs a value.
 */
export const applySavedSettings = (host: IndividualSimHost<any>, settings: SavedSettings): void => {
	batch(() => {
		host.sim.raid.setBuffs(settings.raidBuffs || RaidBuffs.create());
		host.sim.raid.setDebuffs(settings.debuffs || Debuffs.create());
		host.player.getParty()?.setBuffs(settings.partyBuffs || PartyBuffs.create());
		host.player.setBuffs(settings.playerBuffs || IndividualBuffs.create());
		host.player.setConsumes(settings.consumables || ConsumesSpec.create());
		host.player.setRace(settings.race);
		host.player.setProfessions(settings.professions);
		host.player.itemSwapSettings.setItemSwapSettings(
			settings.enableItemSwap,
			host.sim.db.lookupItemSwap(settings.itemSwap || ItemSwap.create()),
			Stats.fromProto(settings.itemSwap?.prepullBonusStats),
		);
		host.player.setReactionTime(settings.reactionTimeMs);
		host.player.setChannelClipDelay(settings.channelClipDelayMs);
		host.player.setInFrontOfTarget(settings.inFrontOfTarget);
		host.player.setDistanceFromTarget(settings.distanceFromTarget);
		host.player.setHealingModel(settings.healingModel || HealingModel.create());
		host.player.setChallengeModeEnabled(settings.challengeMode);
	});
};
