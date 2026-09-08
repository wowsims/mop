import type { ReplayAction, ReplayAura } from '../../model/replay';
import { auraSpellKey } from '../../model/replay';

/** A cast is identified by when it happened: the same spell is cast over and over. */
export const castKey = (action: ReplayAction): string => `${action.time}|${action.name}`;

/** Keyed on the spell rather than the name, as the merge is: two spells can share a name. */
export const auraKey = (aura: ReplayAura): string => `${aura.gainedAt}|${auraSpellKey(aura)}`;
