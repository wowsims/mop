import { ContentBlock } from '../core/components/content_block';
import { buildIconInput } from '../core/components/icon_inputs';
import { Input } from '../core/components/input';
import * as InputHelpers from '../core/components/input_helpers';
import { BooleanPicker } from '../core/components/pickers/boolean_picker';
import { NumberPicker } from '../core/components/pickers/number_picker';
import { IndividualSimUI } from '../core/individual_sim_ui';
import { Player } from '../core/player';
import { Spec } from '../core/proto/common';
import { ShamanImbue, ShamanShield} from '../core/proto/shaman';
import { ActionId } from '../core/proto_utils/action_id';
import { ShamanSpecs } from '../core/proto_utils/utils';
import { EventID, TypedEvent } from '../core/typed_event';
import i18n from '../i18n/config';

// Configuration for class-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const ShamanShieldInput = <SpecType extends ShamanSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, ShamanShield>({
		fieldName: 'shield',
		values: [
			{ value: ShamanShield.NoShield, tooltip: 'No Shield' },
			{ actionId: ActionId.fromSpellId(52127), value: ShamanShield.WaterShield },
			{ actionId: ActionId.fromSpellId(324), value: ShamanShield.LightningShield },
		],
	});

export const ShamanImbueMH = <SpecType extends ShamanSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, ShamanImbue>({
		fieldName: 'imbueMh',
		values: [
			{ value: ShamanImbue.NoImbue, tooltip: 'No Main Hand Enchant' },
			{ actionId: ActionId.fromSpellId(8232), value: ShamanImbue.WindfuryWeapon },
			{ actionId: ActionId.fromSpellId(8024), value: ShamanImbue.FlametongueWeapon },
			{ actionId: ActionId.fromSpellId(8033), value: ShamanImbue.FrostbrandWeapon },
		],
	});

export const ShamanImbueMHSwap = <SpecType extends ShamanSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, ShamanImbue>({
		fieldName: 'imbueMhSwap',
		values: [
			{ value: ShamanImbue.NoImbue, tooltip: 'No Main Hand Swap Enchant' },
			{ actionId: ActionId.fromSpellId(8232), value: ShamanImbue.WindfuryWeapon },
			{ actionId: ActionId.fromSpellId(8024), value: ShamanImbue.FlametongueWeapon },
	    ],
		showWhen: (player: Player<SpecType>) => player.itemSwapSettings.getEnableItemSwap(),
		changeEmitter: (player: Player<SpecType>) => TypedEvent.onAny([player.specOptionsChangeEmitter, player.itemSwapSettings.changeEmitter]),
});

export function TotemsSection(parentElem: HTMLElement, simUI: IndividualSimUI<any>): ContentBlock {
	const contentBlock = new ContentBlock(parentElem, 'totems-settings', {
		header: { title: 'Totems' },
	});

	const feleAbilities = Input.newGroupContainer();
	feleAbilities.classList.add('totem-dropdowns-container', 'icon-group');

	contentBlock.bodyElement.appendChild(feleAbilities);

	const _fireBlastPicker = <SpecType extends ShamanSpecs>() =>
		InputHelpers.makeClassOptionsBooleanIconInput<SpecType>({
			fieldName: 'feleAutocast',
			id: ActionId.fromSpellId(57984),
			getValue: (player: Player<SpecType>) => player.getClassOptions().feleAutocast!.autocastFireblast,
			setValue: (eventID: EventID, player: Player<SpecType>, newValue: boolean) => {
				const newOptions = player.getClassOptions();
				newOptions.feleAutocast!.autocastFireblast = newValue
				player.setClassOptions(eventID, newOptions);
			},
			changeEmitter: (player: Player<SpecType>) => player.specOptionsChangeEmitter,
		});

	const _fireNovaPicker = <SpecType extends ShamanSpecs>() =>
		InputHelpers.makeClassOptionsBooleanIconInput<SpecType>({
			fieldName: 'feleAutocast',
			id: ActionId.fromSpellId(117588),
			getValue: (player: Player<SpecType>) => player.getClassOptions().feleAutocast!.autocastFirenova,
			setValue: (eventID: EventID, player: Player<SpecType>, newValue: boolean) => {
				const newOptions = player.getClassOptions();
				newOptions.feleAutocast!.autocastFirenova = newValue
				player.setClassOptions(eventID, newOptions);
			},
			changeEmitter: (player: Player<SpecType>) => player.specOptionsChangeEmitter,
		});

	const _ImmolationPicker = <SpecType extends ShamanSpecs>() =>
		InputHelpers.makeClassOptionsBooleanIconInput<SpecType>({
			fieldName: 'feleAutocast',
			id: ActionId.fromSpellId(118297),
			getValue: (player: Player<SpecType>) => player.getClassOptions().feleAutocast!.autocastImmolate,
			setValue: (eventID: EventID, player: Player<SpecType>, newValue: boolean) => {
				const newOptions = player.getClassOptions();
				newOptions.feleAutocast!.autocastImmolate = newValue
				player.setClassOptions(eventID, newOptions);
			},
			changeEmitter: (player: Player<SpecType>) => player.specOptionsChangeEmitter,
		});

	const _EmpowerPicker = <SpecType extends ShamanSpecs>() =>
		InputHelpers.makeClassOptionsBooleanIconInput<SpecType>({
			fieldName: 'feleAutocast',
			id: ActionId.fromSpellId(118350),
			getValue: (player: Player<SpecType>) => player.getClassOptions().feleAutocast!.autocastEmpower,
			setValue: (eventID: EventID, player: Player<SpecType>, newValue: boolean) => {
				const newOptions = player.getClassOptions();
				newOptions.feleAutocast!.autocastEmpower = newValue
				player.setClassOptions(eventID, newOptions);
			},
			changeEmitter: (player: Player<SpecType>) => player.specOptionsChangeEmitter,
		});

	buildIconInput(feleAbilities, simUI.player, _fireBlastPicker())
	buildIconInput(feleAbilities, simUI.player, _fireNovaPicker())
	buildIconInput(feleAbilities, simUI.player, _ImmolationPicker())
	buildIconInput(feleAbilities, simUI.player, _EmpowerPicker())

	if(simUI.player.getSpec()==Spec.SpecEnhancementShaman){
		const _DisableImmolateDuringWFUnleash = InputHelpers.makeClassOptionsBooleanInput<ShamanSpecs>({
			fieldName: 'feleAutocast',
			label: i18n.t('settings_tab.other.shaman_disable_immolate.label'),
			labelTooltip: i18n.t('settings_tab.other.shaman_disable_immolate.tooltip'),
			getValue: player => player.getClassOptions().feleAutocast?.noImmolateWfunleash || false,
			setValue:(eventID, player, newVal) => {
				const newOptions = player.getClassOptions();
				newOptions.feleAutocast!.noImmolateWfunleash = newVal;
				player.setClassOptions(eventID, newOptions);
			},
		});
		new BooleanPicker(contentBlock.bodyElement, simUI.player, {..._DisableImmolateDuringWFUnleash, reverse: true});

		const _DisableImmolateDuration = InputHelpers.makeClassOptionsNumberInput<ShamanSpecs>({
			fieldName: 'feleAutocast',
			label: i18n.t('settings_tab.other.shaman_disable_immolate_duration.label'),
			labelTooltip: i18n.t('settings_tab.other.shaman_disable_immolate_duration.tooltip'),
			float: true,
			getValue: player => player.getClassOptions().feleAutocast?.noImmolateDuration || 0,
			setValue:(eventID, player, newVal) => {
				const newOptions = player.getClassOptions();
				newOptions.feleAutocast!.noImmolateDuration = newVal;
				player.setClassOptions(eventID, newOptions);
			},
			showWhen: player => player.getClassOptions().feleAutocast!.noImmolateWfunleash
		});
		new NumberPicker(contentBlock.bodyElement, simUI.player, _DisableImmolateDuration);
	}

	contentBlock.bodyElement.querySelectorAll('.input-root').forEach(elem => {
		elem.classList.add('input-inline');
	});

	return contentBlock;
}