import { useSim } from '../context/SimHostContext';
import { useSimStatus } from './useSimStatus';

/** `useSimStatus` keeps the `sim` parameter: it is the testable primitive, and this is the shorthand. */
export const useSimReady = (): boolean => useSimStatus(useSim()).status === 'ready';
