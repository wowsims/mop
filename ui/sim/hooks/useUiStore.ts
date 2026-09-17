import { useStore } from 'zustand';

import { useSim } from '../context/SimHostContext';
import type { UISlice } from '../state/sim_store';

export type UiStoreField = keyof UISlice;

export const useUiStore = <F extends UiStoreField>(field: F): UISlice[F] => {
	const sim = useSim();
	return useStore(sim.store, s => s.ui[field]);
};
