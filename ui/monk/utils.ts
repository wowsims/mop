import { Player } from '../core/player';
import { TypedEvent } from '../core/typed_event';
import { MonkTalents } from '../core/proto/monk';

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

	player.getRaid()?.setTargetDummies(TypedEvent.nextEventID(), targetDummies);
};
