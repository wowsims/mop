import type { APLRotation } from '@generated/proto/apl';
import { useMemo, useRef } from 'react';
import { useStore } from 'zustand';

import { usePlayer } from '../context/SimHostContext';

/**
 * The rotation is the one player field with no value in the store: it lives on `Player.aplRotation`
 * and the editor mutates it in place, so its identity never changes and Zustand has nothing to
 * compare. The slice's `rotation` counter is the only change signal — hence a selector rather than a
 * returned object, so the result is stable across renders that are not rotation changes.
 */
export const useAplRotation = <T>(select: (rotation: APLRotation) => T): T => {
	const player = usePlayer();
	const selectRef = useRef(select);
	selectRef.current = select;
	const version = useStore(player.sim.store, s => s.players[player.storeKey]?.v.rotation);
	// eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the invalidation key, not an input to the computation.
	return useMemo(() => selectRef.current(player.aplRotation), [player, version]);
};
