import type { Sim } from '@domain/sim';

import { useSimStatus } from './useSimStatus';

/**
 * `true` once `sim.waitForInit()` has resolved — the database is loaded and saved settings have been
 * restored.
 *
 * Several vanilla components are built inside a `waitForInit` callback rather than in a constructor,
 * so the elements React portals into do not exist until then. A portal aimed at one before it exists
 * is React error 299, at load, with no other symptom.
 *
 * Registration order matters and is reliable: an effect here runs after the shell's constructor has
 * queued its own callbacks, so anything the shell does on init has already happened by the time this
 * flips.
 *
 * In `app/` rather than `ui-kit/`: it encodes a fact about *this shell's* init order, which is not
 * something a generic widget kit knows. `useStoreSubscribe` and `useActionId` reach into `@domain`
 * because their subject genuinely is domain state; this one's subject is the composition root.
 */
export const useSimReady = (sim: Sim): boolean => useSimStatus(sim).status === 'ready';
