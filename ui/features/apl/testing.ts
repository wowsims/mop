import { APLRotation } from '@generated/proto/apl';

/**
 * A player stub with just the surface the APL pickers touch.
 *
 * The kind tables call `includeIf(player, …)` for all ~200 kinds, and those reach for the class,
 * the spec, the raid and the encounter — so a stub has to answer all of them or the option list
 * throws before anything renders.
 */
export interface AplTestPlayer {
	aplRotation: APLRotation;
	touchRotation: () => void;
	modifyAplRotation: (change: (rotation: APLRotation) => void) => void;
	[key: string]: any;
}

export const makePlayer = (rotation: APLRotation, notify: () => void = () => {}): AplTestPlayer => {
	const metadata = { getSpells: () => [], getAuras: () => [], getName: () => '' };
	const player: AplTestPlayer = {
		aplRotation: rotation,
		storeKey: 'p0',
		secondaryResource: undefined,
		sim: {
			raid: { getPlayer: () => undefined, getActivePlayers: () => [], size: () => 1 },
			encounter: { targetsMetadata: { asList: () => [] } },
			getUnitMetadata: () => metadata,
			store: { getState: () => ({ players: {} }) },
		},
		getClass: () => 0,
		getSpec: () => -1,
		getRaid: () => ({ size: () => 1 }),
		getSpecIcon: () => '',
		shouldEnableTargetDummies: () => false,
		getPetMetadatas: () => ({ asList: () => [] }),
		getMetadata: () => metadata,
		getCurrentStats: () => ({ rotationStats: undefined }),
		touchRotation: () => notify(),
		modifyAplRotation: (change: (target: APLRotation) => void) => {
			change(player.aplRotation);
			notify();
		},
	};
	return player;
};
