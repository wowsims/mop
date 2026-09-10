import type { UNIT_SET } from '@features/apl/model/unit_sets';
import { unitSets } from '@features/apl/model/unit_sets';
import { refToValue, unitOptionModels } from '@features/apl/model/unit_values';
import type { UnitReference } from '@generated/proto/common';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { Player } from '@sim/player/player';
import { subscribeUnitMetadata } from '@sim/state/subscriptions';
import { DropdownField } from '@ui-kit/DropdownPicker';
import type { InputConfig } from '@ui-kit/input';
import { sameUnit, unitOption } from '@ui-kit/UnitPicker';
import type { UnitValue } from '@ui-kit/UnitPicker/types';
import { useMemo } from 'react';

export interface UnitFieldProps {
	player: Player<any>;
	config: InputConfig<Player<any>, UnitReference | undefined> & { id: string };
	unitSet: UNIT_SET;
}

/**
 * The unit a field points at.
 *
 * It binds through `DropdownField` rather than the unbound `UnitPicker`, because a bound picker's
 * root has to *be* the shell: `UnitPicker` renders a plain `div`, and nesting that inside one would
 * add an element the baseline does not have. The `UnitValue` → option mapping is shared with it.
 *
 * The option list follows unit metadata, which is where pets and targets come from; the selected
 * label is re-resolved on every render, so a pet that gains a name updates without a store write.
 */
export const UnitField = ({ player, config, unitSet }: UnitFieldProps) => {
	const targetUI = unitSets[unitSet].targetUI;
	const subscribe = useMemo(() => subscribeUnitMetadata(player.sim), [player]);
	const models = useStoreSubscribe(subscribe, () => unitOptionModels(unitSet, player));
	const options = useMemo(() => models.map(model => unitOption(model.unit, model.submenu)), [models]);

	const boundConfig = {
		...config,
		extraCssClasses: ['unit-picker-root', 'apl-unit-picker', ...(config.extraCssClasses || [])],
		sourceToValue: (source: UnitReference | undefined) => refToValue(source, player, targetUI),
		valueToSource: (unit: UnitValue) => unit.value,
	};

	return (
		<DropdownField<Player<any>, UnitReference | undefined, UnitValue>
			modObject={player}
			config={boundConfig}
			options={options}
			equals={sameUnit}
			defaultLabel="Unit"
			hideLabelWhenDefault={unit => !unit.value}
		/>
	);
};
