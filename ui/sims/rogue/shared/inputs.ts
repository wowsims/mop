import { ActionId } from '@domain/proto_utils/action_id';
import { RogueSpecs } from '@domain/proto_utils/utils';
import { RogueOptions_PoisonOptions as Poison } from '@generated/proto/rogue';
import i18n from '@i18n/config';
import * as InputHelpers from '@ui-kit/input_helpers';

// Configuration for class-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const LethalPoison = <SpecType extends RogueSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, Poison>({
		fieldName: 'lethalPoison',
		numColumns: 1,
		values: [
			{ value: Poison.NoPoison, tooltip: 'No Lethal Poison' },
			{ actionId: ActionId.fromSpellId(129410), value: Poison.DeadlyPoison },
			{ actionId: ActionId.fromSpellId(8679), value: Poison.WoundPoison },
		],
	});

// export const StartingOverkillDuration = <SpecType extends RogueSpecs>() =>
// 	InputHelpers.makeClassOptionsNumberInput<SpecType>({
// 		fieldName: 'startingOverkillDuration',
// 		label: 'Starting Overkill duration',
// 		labelTooltip: 'Initial Overkill buff duration at the start of each iteration.',
// 		showWhen: (player: Player<SpecType>) => player.getTalents().overkill || player.getTalents().masterOfSubtlety > 0,
// 	});

// export const VanishBreakTime = <SpecType extends RogueSpecs>() =>
// 	InputHelpers.makeClassOptionsNumberInput<SpecType>({
// 		fieldName: 'vanishBreakTime',
// 		label: 'Vanish Break Time',
// 		labelTooltip: 'Time it takes to start attacking after casting Vanish.',
// 		extraCssClasses: ['experimental'],
// 		showWhen: (player: Player<SpecType>) => player.getTalents().overkill || player.getTalents().masterOfSubtlety > 0,
// 	});

export const ApplyPoisonsManually = <SpecType extends RogueSpecs>() =>
	InputHelpers.makeClassOptionsBooleanInput<SpecType>({
		fieldName: 'applyPoisonsManually',
		label: i18n.t('rotation_tab.options.rogue.apply_poisons_manually.label'),
		labelTooltip: i18n.t('rotation_tab.options.rogue.apply_poisons_manually.tooltip'),
	});
