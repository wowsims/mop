import { SavedEncounter } from '@generated/proto/ui';
import type { Encounter } from '@sim/raid/encounter';

export const encounterData = (encounter: Encounter): SavedEncounter => SavedEncounter.create({ encounter: encounter.toProto() });

export const serializeEncounter = (data: SavedEncounter): string => JSON.stringify(SavedEncounter.toJson(data));
