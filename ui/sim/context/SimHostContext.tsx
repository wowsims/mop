import type { Spec } from '@generated/proto/common';
import { createContext, type ReactNode, useContext } from 'react';

import type { Sim } from '../sim';
import type { IndividualSimHost } from '../sim_host';

const SimHostContext = createContext<IndividualSimHost<any> | null>(null);

// Nullable because the provider wraps the shell that builds the host: it carries null for the one render that creates the containers the host is constructed against.
export function SimHostProvider({ host, children }: { host: IndividualSimHost<any> | null; children: ReactNode }) {
	return <SimHostContext.Provider value={host}>{children}</SimHostContext.Provider>;
}

export function useSimHost<SpecType extends Spec = any>(): IndividualSimHost<SpecType> {
	const host = useContext(SimHostContext);
	// Non-null rather than `Host | null`: every consumer is gated on the host existing, so a null here is a component that escaped the gate, which is a bug and not a state to handle.
	if (!host) throw new Error('useSimHost must be used inside <SimHostProvider>');
	return host;
}

export const usePlayer = <SpecType extends Spec = any>() => useSimHost<SpecType>().player;
export const useSim = (): Sim => useSimHost().sim;
