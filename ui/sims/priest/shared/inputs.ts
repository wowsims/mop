import { ActionId } from '@domain/proto_utils/action_id';
import { PriestSpecs } from '@domain/proto_utils/utils';
import { PriestOptions_Armor } from '@generated/proto/priest';
import * as InputHelpers from '@ui-kit/input_helpers';

// Configuration for class-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const ArmorInput = <SpecType extends PriestSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, PriestOptions_Armor>({
		fieldName: 'armor',
		values: [
			{ value: PriestOptions_Armor.NoArmor, tooltip: 'No Inner Fire' },
			{ actionId: ActionId.fromSpellId(48168), value: PriestOptions_Armor.InnerFire },
		],
	});
