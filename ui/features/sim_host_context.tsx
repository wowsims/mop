// Ambient access to the sim shell, so a feature does not thread `host` and `player` through every
// level to reach a leaf.
//
// **The value is identity, never state.** It holds the same three references for the lifetime of
// the page. Putting anything that changes in here would re-render every consumer on every store
// notification, whatever that consumer actually reads — and this store is written constantly (sim
// progress ticks bypass it entirely for exactly that reason). Reactivity stays per-component:
// `useStoreSubscribe` for a `StoreSubscribe` source, or zustand's `useStore(useSim().store, sel)`.
//
// It lives in `features/` rather than `app/` because `ui/features/**` may not import `@app`, and
// `ui-kit/**` may not import `@features` — so `ui-kit` stays context-free by construction, which is
// also the design rule: a generic picker's `modObject` is sim, encounter or an APL action as often
// as it is the player.
import type { Sim } from '@domain/sim';
import type { Spec } from '@generated/proto/common';
import { createContext, type ReactNode, useContext } from 'react';

import type { IndividualSimHost } from './sim_host';

const SimHostContext = createContext<IndividualSimHost<any> | null>(null);

export function SimHostProvider({ host, children }: { host: IndividualSimHost<any>; children: ReactNode }) {
	return <SimHostContext.Provider value={host}>{children}</SimHostContext.Provider>;
}

export function useSimHost<SpecType extends Spec = any>(): IndividualSimHost<SpecType> {
	const host = useContext(SimHostContext);
	// Non-null rather than `Host | null`: the provider renders only once the shell is constructed,
	// so a null here is a component mounted outside it, which is a bug and not a state to handle.
	if (!host) throw new Error('useSimHost must be used inside <SimHostProvider>');
	return host;
}

export const usePlayer = <SpecType extends Spec = any>() => useSimHost<SpecType>().player;
export const useSim = (): Sim => useSimHost().sim;
