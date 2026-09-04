import { Player } from '@domain/player';
import { ActionId } from '@domain/proto_utils/action_id';
import { DruidSpecs } from '@domain/proto_utils/utils';
import { UnitReference, UnitReference_Type as UnitType } from '@generated/proto/common';
import * as InputHelpers from '@ui-kit/input_helpers';
// Configuration for class-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const SelfInnervate = <SpecType extends DruidSpecs>() =>
	InputHelpers.makeClassOptionsBooleanIconInput<SpecType>({
		fieldName: 'innervateTarget',
		id: ActionId.fromSpellId(29166),
		getValue: (player: Player<SpecType>) => player.getClassOptions().innervateTarget?.type == UnitType.Player,
		setValue: (player: Player<SpecType>, newValue: boolean) => {
			const newOptions = player.getClassOptions();
			newOptions.innervateTarget = UnitReference.create({
				type: newValue ? UnitType.Player : UnitType.Unknown,
				index: 0,
			});
			player.setClassOptions(newOptions);
		},
	});
