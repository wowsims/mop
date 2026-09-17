import { useStore } from 'zustand';

import { useSim } from '../context/SimHostContext';
import type { SimSettingsSlice } from '../state/sim_store';

export type SimStoreField = keyof SimSettingsSlice;

export const useSimStore = <F extends SimStoreField>(field: F): SimSettingsSlice[F] => {
	const sim = useSim();
	return useStore(sim.store, s => s.sim[field]);
};
