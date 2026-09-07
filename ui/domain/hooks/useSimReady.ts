import type { Sim } from '../sim';

import { useSimStatus } from './useSimStatus';

export const useSimReady = (sim: Sim): boolean => useSimStatus(sim).status === 'ready';
