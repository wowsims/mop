import { rotationSource } from '@features/apl/utils';
import type { Player } from '@sim/player/player';
import type { StoreSubscribe } from '@sim/state/subscriptions';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

export interface AplScope {
	/** Inside the pre-pull list, which offers a different set of action and value kinds. */
	isPrepull: boolean;
	/** Inside an action group, which is the only place a variable placeholder may be used. */
	isGroup: boolean;
	/** What the pickers below subscribe to: the rotation, or inside a list row that row's `rowSource`. */
	changeSource: (player: Player<any>) => StoreSubscribe;
}

const DEFAULT: AplScope = { isPrepull: false, isGroup: false, changeSource: rotationSource };

const AplContext = createContext<AplScope>(DEFAULT);

export interface AplProviderProps extends Partial<AplScope> {
	children?: ReactNode;
}

/**
 * Which APL list the pickers below are being rendered inside.
 *
 * It travels down rather than being read up off the DOM — `closest('.apl-prepull-action-picker')`
 * and its kin cannot answer, because a React component renders before it is in the document.
 */
export const AplProvider = ({ isPrepull, isGroup, changeSource, children }: AplProviderProps) => {
	const parent = useContext(AplContext);
	const scope = useMemo(
		() => ({ isPrepull: isPrepull ?? parent.isPrepull, isGroup: isGroup ?? parent.isGroup, changeSource: changeSource ?? parent.changeSource }),
		[isPrepull, isGroup, changeSource, parent],
	);
	return <AplContext value={scope}>{children}</AplContext>;
};

export const useApl = (): AplScope => useContext(AplContext);
