import type { Encounter } from '@sim/encounter';
import { SavedEncounter } from '@generated/proto/ui';

export const encounterData = (encounter: Encounter): SavedEncounter => SavedEncounter.create({ encounter: encounter.toProto() });

export const serializeEncounter = (data: SavedEncounter): string => JSON.stringify(SavedEncounter.toJson(data));
