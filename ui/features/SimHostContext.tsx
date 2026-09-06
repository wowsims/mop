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
	// Non-null rather than `Host | null`: the provider renders only once the shell is constructed, so a null here is a component mounted outside it, which is a bug and not a state to handle.
	if (!host) throw new Error('useSimHost must be used inside <SimHostProvider>');
	return host;
}

export const usePlayer = <SpecType extends Spec = any>() => useSimHost<SpecType>().player;
export const useSim = (): Sim => useSimHost().sim;
