import { useStore } from 'zustand';

import type { Sim } from '../sim';

export const useUnitMetadataVersion = (sim: Sim): number => useStore(sim.store, s => s.sim.metadataVersion);
