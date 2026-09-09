import { createContext, type ReactNode, useContext, useMemo } from 'react';

export interface AplScope {
	/** Inside the pre-pull list, which offers a different set of action and value kinds. */
	isPrepull: boolean;
	/** Inside an action group, which is the only place a variable placeholder may be used. */
	isGroup: boolean;
}

const DEFAULT: AplScope = { isPrepull: false, isGroup: false };

const AplScopeContext = createContext<AplScope>(DEFAULT);

export interface AplScopeProviderProps extends Partial<AplScope> {
	children?: ReactNode;
}

/**
 * Which APL list the pickers below are being rendered inside.
 *
 * It travels down rather than being read up off the DOM — `closest('.apl-prepull-action-picker')`
 * and its kin cannot answer, because a React component renders before it is in the document.
 */
export const AplScopeProvider = ({ isPrepull = false, isGroup = false, children }: AplScopeProviderProps) => {
	const scope = useMemo(() => ({ isPrepull, isGroup }), [isPrepull, isGroup]);
	return <AplScopeContext value={scope}>{children}</AplScopeContext>;
};

export const useAplScope = (): AplScope => useContext(AplScopeContext);
