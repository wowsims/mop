import type { Sim } from '@domain/sim';

import { useSimStatus } from './useSimStatus';

export const useSimReady = (sim: Sim): boolean => useSimStatus(sim).status === 'ready';
