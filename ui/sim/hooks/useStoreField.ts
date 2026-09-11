import { useMemo } from 'react';

import { useOptionalSimHost } from '../context/SimHostContext';
import type { IndividualSimHost } from '../sim_host';
import type { BulkSlice, EncounterSlice, PlayerField, RaidSlice, ReforgeField, SimSettingsSlice, StatWeightsSlice, UISlice } from '../state/sim_store';
import type { StoreSubscribe } from '../state/subscriptions';
import {
	subscribeAll,
	subscribeBulkField,
	subscribeEncounterChange,
	subscribeEncounterField,
	subscribePlayerChange,
	subscribePlayerField,
	subscribePlayerReforgeField,
	subscribePlayerStatWeightsField,
	subscribeRaidField,
	subscribeSimField,
	subscribeUiField,
} from '../state/subscriptions';

type BulkField = keyof BulkSlice['v'];
type StatWeightsField = keyof StatWeightsSlice['v'];

/** A store field named as data. A bare name is a player field; every other slice carries its scope. */
export type StoreField =
	| PlayerField
	| `sim:${keyof SimSettingsSlice}`
	| `ui:${keyof UISlice}`
	| `encounter:${keyof EncounterSlice}`
	| `raid:${keyof RaidSlice}`
	| `reforge:${ReforgeField}`
	| `bulk:${BulkField}`
	| `statWeights:${StatWeightsField}`
	| 'player:*'
	| 'encounter:*';

const resolve = (host: IndividualSimHost<any>, field: StoreField): StoreSubscribe => {
	if (field === 'player:*') return subscribePlayerChange(host.player);
	if (field === 'encounter:*') return subscribeEncounterChange(host.sim.encounter);
	const at = field.indexOf(':');
	if (at < 0) return subscribePlayerField(host.player, field as PlayerField);
	const scope = field.slice(0, at);
	const name = field.slice(at + 1);
	if (scope === 'sim') return subscribeSimField(host.sim, name as keyof SimSettingsSlice);
	if (scope === 'ui') return subscribeUiField(host.sim, name as keyof UISlice);
	if (scope === 'encounter') return subscribeEncounterField(host.sim.encounter, name as keyof EncounterSlice);
	if (scope === 'raid') return subscribeRaidField(host.sim.raid, name as keyof RaidSlice);
	if (scope === 'bulk') return subscribeBulkField(host.player, name as BulkField);
	if (scope === 'statWeights') return subscribePlayerStatWeightsField(host.player, name as StatWeightsField);
	return subscribePlayerReforgeField(host.player, name as ReforgeField);
};

/** The source identity is the whole contract: `useStoreSubscribe` re-subscribes whenever it changes, so it is keyed on the names and not on the array the caller wrote. */
export const useStoreField = (field?: StoreField | ReadonlyArray<StoreField>): StoreSubscribe | undefined => {
	const host = useOptionalSimHost();
	const key = field === undefined ? '' : typeof field === 'string' ? field : field.join('|');
	return useMemo(() => {
		if (!key) return undefined;
		if (!host) throw new Error(`useStoreField('${key}') must be used inside <SimHostProvider>`);
		const fields = key.split('|') as Array<StoreField>;
		return fields.length === 1 ? resolve(host, fields[0]) : subscribeAll(fields.map(one => resolve(host, one)));
	}, [host, key]);
};
