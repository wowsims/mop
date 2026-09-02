import { MonkTalents } from '@core/proto/monk';
import { Player } from '@domain/player';
import { nextEventID } from '@domain/state/batch';
import { subscribePlayerField } from '@domain/state/subscriptions';
import type { DerivedSetting } from '@features/spec_config';

/**
 * Sets talent-based settings for monk specs, particularly target dummies
 * based on talent selections that affect targeting mechanics.
 *
 * @param player - The player instance to apply settings to
 */
export const setTalentBasedSettings = (player: Player<any>) => {
	const talents = player.getTalents() as MonkTalents;
	let targetDummies = 0;

	// Zen sphere can be on 2 targets, so we set the target dummies to 2 if it is talented.
	if (talents.zenSphere) {
		targetDummies = 2;
		// Chi Wave jumps to the nearest target requiring a heal, so we set the target dummies to 9 if it is talented.
		// This is done to get a better approximation of the healing done by Chi Wave.
	} else if (talents.chiWave) {
		targetDummies = 9;
	}

	player.getRaid()?.setTargetDummies(nextEventID(), targetDummies);
};

// Zen Sphere / Chi Wave decide how many target dummies the raid needs, so the
// setting is derived from the talent string. Both monk spec constructors applied
// it once and re-applied it on every talent change.
//
// Declared as `DerivedSetting<any>` because `Player<S>` is invariant in `S`, so a
// rule typed against the monk spec union would not be assignable into any one
// spec's `derivedSettings`.
export const talentBasedSettingsRule: DerivedSetting<any> = {
	subscribe: player => subscribePlayerField(player, 'talentsString'),
	apply: (_eventID, player) => setTalentBasedSettings(player),
};
