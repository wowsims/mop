import { Party } from '@domain/party';
import { Player } from '@domain/player';
import { ActionId } from '@domain/proto_utils/action_id';
import { Raid } from '@domain/raid';
import { subscribeAll, subscribePartyBuffs, subscribePlayerField, subscribeRaidField } from '@domain/state/subscriptions';
import { ConsumesSpec, Debuffs, Faction, IndividualBuffs, PartyBuffs, RaidBuffs, Spec } from '@generated/proto/common';

import * as InputHelpers from './input_helpers';
import { IconEnumPicker } from './pickers/icon_enum_picker';
import { IconPicker } from './pickers/icon_picker';
// Component Functions

export type IconInputConfig<ModObject, T> = InputHelpers.TypedIconPickerConfig<ModObject, T> | InputHelpers.TypedIconEnumPickerConfig<ModObject, T>;

export const buildIconInput = <SpecType extends Spec>(parent: HTMLElement, player: Player<SpecType>, inputConfig: IconInputConfig<Player<SpecType>, any>) => {
	if (inputConfig.type == 'icon') {
		return new IconPicker<Player<SpecType>, any>(parent, player, inputConfig);
	} else if (inputConfig.type == 'iconEnum') {
		return new IconEnumPicker<Player<SpecType>, any>(parent, player, inputConfig);
	} else {
		throw new Error('Unsupported input type');
	}
};

export const withLabel = <ModObject, T>(config: IconInputConfig<ModObject, T>, label: string): IconInputConfig<ModObject, T> => {
	config.label = label;
	return config;
};

interface BooleanInputConfig<T> {
	actionId: ActionId;
	fieldName: keyof T;
	value?: number;
	label?: string;
	faction?: Faction;
	showWhen?: (player: Player<any>) => boolean;
}

export const makeBooleanRaidBuffInput = <SpecType extends Spec>(
	config: BooleanInputConfig<RaidBuffs>,
): InputHelpers.TypedIconPickerConfig<Player<SpecType>, boolean> => {
	return InputHelpers.makeBooleanIconInput<any, RaidBuffs, Player<SpecType>>(
		{
			getModObject: (player: Player<SpecType>) => player,
			showWhen: (player: Player<SpecType>) => !config.faction || config.faction == player.getFaction(),
			getValue: (player: Player<SpecType>) => player.getRaid()!.getBuffs(),
			setValue: (player: Player<SpecType>, newVal: RaidBuffs) => player.getRaid()!.setBuffs(newVal),
			storeSubscribe: (player: Player<SpecType>) => subscribeAll([subscribeRaidField(player.getRaid()!, 'buffs'), subscribePlayerField(player, 'race')]),
		},
		config.actionId,
		config.fieldName,
		config.value,
		config.label,
	);
};
export const makeBooleanPartyBuffInput = <SpecType extends Spec>(
	config: BooleanInputConfig<PartyBuffs>,
): InputHelpers.TypedIconPickerConfig<Player<SpecType>, boolean> => {
	return InputHelpers.makeBooleanIconInput<any, PartyBuffs, Party>(
		{
			getModObject: (player: Player<SpecType>) => player.getParty()!,
			getValue: (party: Party) => party.getBuffs(),
			setValue: (party: Party, newVal: PartyBuffs) => party.setBuffs(newVal),
			storeSubscribe: (party: Party) => subscribePartyBuffs(party),
		},
		config.actionId,
		config.fieldName,
		config.value,
	);
};

export const makeBooleanIndividualBuffInput = <SpecType extends Spec>(
	config: BooleanInputConfig<IndividualBuffs>,
): InputHelpers.TypedIconPickerConfig<Player<SpecType>, boolean> => {
	return InputHelpers.makeBooleanIconInput<any, IndividualBuffs, Player<SpecType>>(
		{
			getModObject: (player: Player<SpecType>) => player,
			showWhen: (player: Player<SpecType>) => !config.faction || config.faction == player.getFaction(),
			getValue: (player: Player<SpecType>) => player.getBuffs(),
			setValue: (player: Player<SpecType>, newVal: IndividualBuffs) => player.setBuffs(newVal),
			storeSubscribe: (player: Player<SpecType>) => subscribeAll([subscribePlayerField(player, 'buffs'), subscribePlayerField(player, 'race')]),
		},
		config.actionId,
		config.fieldName,
		config.value,
		config.label,
	);
};

export const makeBooleanConsumeInput = <SpecType extends Spec>(
	config: BooleanInputConfig<ConsumesSpec>,
): InputHelpers.TypedIconPickerConfig<Player<SpecType>, boolean> => {
	return InputHelpers.makeBooleanIconInput<any, ConsumesSpec, Player<SpecType>>(
		{
			getModObject: (player: Player<SpecType>) => player,
			getValue: (player: Player<SpecType>) => player.getConsumes(),
			setValue: (player: Player<SpecType>, newVal: ConsumesSpec) => player.setConsumes(newVal),
			storeSubscribe: (player: Player<SpecType>) =>
				subscribeAll([
					subscribePlayerField(player, 'consumables'),
					subscribePlayerField(player, 'profession1'),
					subscribePlayerField(player, 'profession2'),
				]),
			showWhen: (player: Player<SpecType>) => !config.showWhen || config.showWhen(player),
		},
		config.actionId,
		config.fieldName,
		config.value,
	);
};
export const makeBooleanDebuffInput = <SpecType extends Spec>(
	config: BooleanInputConfig<Debuffs>,
): InputHelpers.TypedIconPickerConfig<Player<SpecType>, boolean> => {
	return InputHelpers.makeBooleanIconInput<any, Debuffs, Player<SpecType>>(
		{
			getModObject: (player: Player<SpecType>) => player,
			getValue: (player: Player<SpecType>) => player.getRaid()!.getDebuffs(),
			setValue: (player: Player<SpecType>, newVal: Debuffs) => player.getRaid()!.setDebuffs(newVal),
			storeSubscribe: (player: Player<SpecType>) => subscribeRaidField(player.getRaid()!, 'debuffs'),
		},
		config.actionId,
		config.fieldName,
		config.value,
		config.label,
	);
};

interface TristateInputConfig<T> {
	actionId: ActionId;
	impId: ActionId;
	fieldName: keyof T;
	faction?: Faction;
	label?: string;
}

export const makeTristateRaidBuffInput = <SpecType extends Spec>(
	config: TristateInputConfig<RaidBuffs>,
): InputHelpers.TypedIconPickerConfig<Player<SpecType>, number> => {
	return InputHelpers.makeTristateIconInput<any, RaidBuffs, Player<SpecType>>(
		{
			getModObject: (player: Player<SpecType>) => player,
			showWhen: (player: Player<SpecType>) => !config.faction || config.faction == player.getFaction(),
			getValue: (player: Player<SpecType>) => player.getRaid()!.getBuffs(),
			setValue: (player: Player<SpecType>, newVal: RaidBuffs) => player.getRaid()!.setBuffs(newVal),
			storeSubscribe: (player: Player<SpecType>) => subscribeAll([subscribeRaidField(player.getRaid()!, 'buffs'), subscribePlayerField(player, 'race')]),
		},
		config.actionId,
		config.impId,
		config.fieldName,
		config.label,
	);
};

export const makeTristateIndividualBuffInput = <SpecType extends Spec>(
	config: TristateInputConfig<IndividualBuffs>,
): InputHelpers.TypedIconPickerConfig<Player<SpecType>, number> => {
	return InputHelpers.makeTristateIconInput<any, IndividualBuffs, Player<SpecType>>(
		{
			getModObject: (player: Player<SpecType>) => player,
			showWhen: (player: Player<SpecType>) => !config.faction || config.faction == player.getFaction(),
			getValue: (player: Player<SpecType>) => player.getBuffs(),
			setValue: (player: Player<SpecType>, newVal: IndividualBuffs) => player.setBuffs(newVal),
			storeSubscribe: (player: Player<SpecType>) => subscribeAll([subscribePlayerField(player, 'buffs'), subscribePlayerField(player, 'race')]),
		},
		config.actionId,
		config.impId,
		config.fieldName,
		config.label,
	);
};

export const makeTristateDebuffInput = <SpecType extends Spec>(
	config: TristateInputConfig<Debuffs>,
): InputHelpers.TypedIconPickerConfig<Player<SpecType>, number> => {
	return InputHelpers.makeTristateIconInput<any, Debuffs, Raid>(
		{
			getModObject: (player: Player<SpecType>) => player.getRaid()!,
			getValue: (raid: Raid) => raid.getDebuffs(),
			setValue: (raid: Raid, newVal: Debuffs) => raid.setDebuffs(newVal),
			storeSubscribe: (raid: Raid) => subscribeRaidField(raid, 'debuffs'),
		},
		config.actionId,
		config.impId,
		config.fieldName,
		config.label,
	);
};

interface QuadStateInputConfig<T> {
	actionId: ActionId;
	impId: ActionId;
	impId2: ActionId;
	fieldName: keyof T;
	faction?: Faction;
}

export const makeQuadstateDebuffInput = <SpecType extends Spec>(
	config: QuadStateInputConfig<Debuffs>,
): InputHelpers.TypedIconPickerConfig<Player<SpecType>, number> => {
	return InputHelpers.makeQuadstateIconInput<any, Debuffs, Raid>(
		{
			getModObject: (player: Player<SpecType>) => player.getRaid()!,
			getValue: (raid: Raid) => raid.getDebuffs(),
			setValue: (raid: Raid, newVal: Debuffs) => raid.setDebuffs(newVal),
			storeSubscribe: (raid: Raid) => subscribeRaidField(raid, 'debuffs'),
		},
		config.actionId,
		config.impId,
		config.impId2,
		config.fieldName,
	);
};

interface MultiStateInputConfig<T> {
	actionId: ActionId;
	label?: string;
	numStates: number;
	fieldName: keyof T;
	multiplier?: number;
	faction?: Faction;
}

export const makeMultistateRaidBuffInput = <SpecType extends Spec>(
	config: MultiStateInputConfig<RaidBuffs>,
): InputHelpers.TypedIconPickerConfig<Player<SpecType>, number> => {
	return InputHelpers.makeMultistateIconInput<any, RaidBuffs, Player<SpecType>>(
		{
			getModObject: (player: Player<SpecType>) => player,
			showWhen: (player: Player<SpecType>) => !config.faction || config.faction == player.getFaction(),
			getValue: (player: Player<SpecType>) => player.getRaid()!.getBuffs(),
			setValue: (player: Player<SpecType>, newVal: RaidBuffs) => player.getRaid()!.setBuffs(newVal),
			storeSubscribe: (player: Player<SpecType>) => subscribeAll([subscribeRaidField(player.getRaid()!, 'buffs'), subscribePlayerField(player, 'race')]),
		},
		config.actionId,
		config.numStates,
		config.fieldName,
		config.multiplier,
		config.label,
	);
};
export const makeMultistatePartyBuffInput = <SpecType extends Spec>(
	actionId: ActionId,
	numStates: number,
	fieldName: keyof PartyBuffs,
	label?: string,
): InputHelpers.TypedIconPickerConfig<Player<SpecType>, number> => {
	return InputHelpers.makeMultistateIconInput<any, PartyBuffs, Party>(
		{
			getModObject: (player: Player<SpecType>) => player.getParty()!,
			getValue: (party: Party) => party.getBuffs(),
			setValue: (party: Party, newVal: PartyBuffs) => party.setBuffs(newVal),
			storeSubscribe: (party: Party) => subscribePartyBuffs(party),
		},
		actionId,
		numStates,
		fieldName,
		undefined,
		label,
	);
};
export const makeMultistateIndividualBuffInput = <SpecType extends Spec>(
	config: MultiStateInputConfig<IndividualBuffs>,
): InputHelpers.TypedIconPickerConfig<Player<SpecType>, number> => {
	return InputHelpers.makeMultistateIconInput<any, IndividualBuffs, Player<SpecType>>(
		{
			getModObject: (player: Player<SpecType>) => player,
			showWhen: (player: Player<SpecType>) => !config.faction || config.faction == player.getFaction(),
			getValue: (player: Player<SpecType>) => player.getBuffs(),
			setValue: (player: Player<SpecType>, newVal: IndividualBuffs) => player.setBuffs(newVal),
			storeSubscribe: (player: Player<SpecType>) => subscribeAll([subscribePlayerField(player, 'buffs'), subscribePlayerField(player, 'race')]),
		},
		config.actionId,
		config.numStates,
		config.fieldName,
		config.multiplier,
		config.label,
	);
};

export const makeMultistateMultiplierIndividualBuffInput = <SpecType extends Spec>(
	actionId: ActionId,
	numStates: number,
	multiplier: number,
	fieldName: keyof IndividualBuffs,
): InputHelpers.TypedIconPickerConfig<Player<SpecType>, number> => {
	return InputHelpers.makeMultistateIconInput<any, IndividualBuffs, Player<SpecType>>(
		{
			getModObject: (player: Player<SpecType>) => player,
			getValue: (player: Player<SpecType>) => player.getBuffs(),
			setValue: (player: Player<SpecType>, newVal: IndividualBuffs) => player.setBuffs(newVal),
			storeSubscribe: (player: Player<SpecType>) => subscribePlayerField(player, 'buffs'),
		},
		actionId,
		numStates,
		fieldName,
		multiplier,
	);
};

export const makeMultistateMultiplierDebuffInput = <SpecType extends Spec>(
	actionId: ActionId,
	numStates: number,
	multiplier: number,
	fieldName: keyof Debuffs,
): InputHelpers.TypedIconPickerConfig<Player<any>, number> => {
	return InputHelpers.makeMultistateIconInput<any, Debuffs, Raid>(
		{
			getModObject: (player: Player<SpecType>) => player.getRaid()!,
			getValue: (raid: Raid) => raid.getDebuffs(),
			setValue: (raid: Raid, newVal: Debuffs) => raid.setDebuffs(newVal),
			storeSubscribe: (raid: Raid) => subscribeRaidField(raid, 'debuffs'),
		},
		actionId,
		numStates,
		fieldName,
		multiplier,
	);
};

// interface EnumInputConfig<ModObject, Message, T> {
// 	fieldName: keyof Message
// 	values: Array<IconEnumValueConfig<ModObject, T>>
// 	direction?: IconEnumPickerDirection
// 	numColumns?: number
// 	faction?: Faction
// }

// export function makeEnumIndividualBuffInput<SpecType extends Spec>(config: EnumInputConfig<Player<SpecType>, IndividualBuffs, number>): InputHelpers.TypedIconEnumPickerConfig<Player<SpecType>, number> {
// 	return InputHelpers.makeEnumIconInput<any, IndividualBuffs, Player<SpecType>, number>({
// 		getModObject: (player: Player<SpecType>) => player,
// 		showWhen: (player: Player<SpecType>) =>
// 			(!config.faction || config.faction == player.getFaction()),
// 		getValue: (player: Player<SpecType>) => player.getBuffs(),
// 		setValue: (player: Player<SpecType>, newVal: IndividualBuffs) => player.setBuffs(newVal),
// 	}, config.fieldName, config.values, config.numColumns, config.direction || IconEnumPickerDirection.Vertical)
// };
