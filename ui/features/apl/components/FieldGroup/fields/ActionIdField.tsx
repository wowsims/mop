import { useApl } from '@features/apl/context/AplContext';
import { type ACTION_ID_SET, actionIdSets } from '@features/apl/model/action_id_sets';
import type { DEFAULT_UNIT_REF } from '@features/apl/model/field_descriptors';
import { ActionID, UnitReference, UnitReference_Type as UnitType } from '@generated/proto/common';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import { subscribeAll, subscribeUnitMetadata } from '@sim/state/subscriptions';
import { DropdownField, type DropdownOption } from '@ui-kit/DropdownPicker';
import { useActionId } from '@ui-kit/hooks/useActionId';
import type { InputConfig } from '@ui-kit/input';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ActionIdIcon } from './ActionIdIcon';

/** The four sets whose entries are auras, and so want the buff's tooltip rather than the spell's. */
const AURA_SETS: ReadonlySet<ACTION_ID_SET> = new Set(['auras', 'stackable_auras', 'icd_auras', 'exclusive_effect_auras']);

export interface ActionIdFieldProps {
	player: Player<any>;
	config: InputConfig<Player<any>, ActionID> & { id: string };
	actionIdSet: ACTION_ID_SET;
	/** The sibling field naming the unit whose spells or auras to offer. Absent means "no unit". */
	unitRefField: string | undefined;
	defaultUnitRef: DEFAULT_UNIT_REF;
	/** The kind's impl message, which is where `unitRefField` is read from. */
	getParentValue: () => any;
}

const sameActionId = (a: ActionId | undefined, b: ActionId | undefined) => (a == null) == (b == null) && (!a || a.equals(b!));

/**
 * The spell or aura a field names.
 *
 * Two things it does beyond binding a dropdown:
 *
 * - **The option list is asynchronous and follows a unit.** `getActionIDs` reads the metadata of
 *   whatever `unitRefField` points at; the effect's cleanup is what discards a stale await, and the
 *   dependency array is what stops a rotation edit that leaves the unit alone re-reading anything.
 *   A metadata *notification* still forces a refetch, because metadata is mutated in place.
 * - **A selection the list does not contain still shows.** It becomes an extra option, and an id
 *   with no ids at all deliberately matches nothing so the picker falls back to its default label.
 */
export const ActionIdField = ({ player, config, actionIdSet, unitRefField, defaultUnitRef, getParentValue }: ActionIdFieldProps) => {
	const set = actionIdSets[actionIdSet];
	const useBuffAura = AURA_SETS.has(actionIdSet);

	const parentRef = useRef(getParentValue);
	parentRef.current = getParentValue;

	const defaultRef = useMemo(() => UnitReference.create({ type: defaultUnitRef == 'self' ? UnitType.Self : UnitType.CurrentTarget }), [defaultUnitRef]);

	// One subscription for both reads: the referenced unit can change with the rotation, and its
	// metadata can change on its own.
	const { changeSource } = useApl();
	const subscribe = useMemo(() => subscribeAll([changeSource(player), subscribeUnitMetadata(player.sim)]), [player, changeSource]);
	const view = useStoreSubscribe(subscribe, () => ({
		metadata: player.sim.getUnitMetadata(unitRefField ? parentRef.current()[unitRefField] : UnitReference.create(), player, defaultRef),
		source: config.getValue(player),
	}));

	// Metadata is mutated in place, so its identity does not move when it gains a spell. This counter
	// is what forces the refetch off the notification instead.
	const [metadataEpoch, setMetadataEpoch] = useState(0);
	useEffect(() => subscribeUnitMetadata(player.sim)(() => setMetadataEpoch(epoch => epoch + 1)), [player]);

	const [available, setAvailable] = useState<Array<DropdownOption<ActionId>>>([]);
	const { metadata } = view;
	useEffect(() => {
		if (!metadata) return;
		let live = true;
		set.getActionIDs(metadata).then(values => {
			if (!live) return;
			setAvailable(
				values
					// The four `headerText` entries in `action_id_sets.ts` are list padding: they name no
					// action and have never rendered.
					.filter(value => !value.headerText)
					.map(value => ({
						value: value.value,
						label: value.value.name,
						icon: <ActionIdIcon actionId={value.value} useBuffAura={useBuffAura} />,
						itemClassName: value.extraClassNames,
						submenu: value.submenu,
						tooltip: value.tooltip,
					})),
			);
		});
		return () => {
			live = false;
		};
	}, [metadata, metadataEpoch, set, useBuffAura]);

	const selected = useMemo(() => (view.source ? ActionId.fromProto(view.source) : ActionId.fromEmpty()), [view.source]);
	const isMissing = selected.anyId() != 0 && !available.some(option => sameActionId(option.value, selected));
	const { name: missingName } = useActionId(isMissing ? selected : undefined);

	const options = useMemo(
		() =>
			isMissing
				? [...available, { value: selected, label: missingName, icon: <ActionIdIcon actionId={selected} useBuffAura={useBuffAura} /> }]
				: available,
		[available, isMissing, selected, missingName, useBuffAura],
	);

	const boundConfig = {
		...config,
		sourceToValue: (source: ActionID) => (source ? ActionId.fromProto(source) : ActionId.fromEmpty()),
		// A field the user never filled in has no selection, and the kind-swap pre-fill reads the old
		// kind's fields regardless — so an absent value hands back the empty proto the field spec
		// mints rather than throwing.
		valueToSource: (value: ActionId | undefined) => (value ? value.toProto() : ActionID.create()),
	};

	return (
		<DropdownField<Player<any>, ActionID, ActionId>
			modObject={player}
			config={boundConfig}
			options={options}
			equals={sameActionId}
			defaultLabel={set.defaultLabel}
		/>
	);
};
