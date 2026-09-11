import { Party } from '@sim/raid/party';
import { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import { Raid } from '@sim/raid/raid';
import { subscribePartyBuffs } from '@sim/state/subscriptions';
import { ConsumesSpec, Debuffs, Faction, IndividualBuffs, PartyBuffs, RaidBuffs, Spec } from '@generated/proto/common';

import * as InputHelpers from './input_helpers';

export type IconInputConfig<ModObject, T> = InputHelpers.TypedIconPickerConfig<ModObject, T> | InputHelpers.TypedIconEnumPickerConfig<ModObject, T>;

/**
 * How many equal columns an icon group of `count` icons gets, used by both the player settings
 * block and the rotation tab's icon row.
 * Zero icons and eight or more are left to the stylesheet.
 */
export const iconGridColumns = (count: number): string | undefined => {
	if (count === 0 || count >= 8) return undefined;
	return `repeat(${count <= 4 ? count : Math.ceil(count / 2)}, 1fr)`;
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
			storeField: ['raid:buffs', 'race'],
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
			storeField: ['buffs', 'race'],
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
			storeField: ['consumables', 'profession1', 'profession2'],
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
			storeField: 'raid:debuffs',
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
			storeField: ['raid:buffs', 'race'],
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
			storeField: ['buffs', 'race'],
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
			storeField: 'raid:debuffs',
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
			storeField: 'raid:debuffs',
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
			storeField: ['raid:buffs', 'race'],
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
			storeField: ['buffs', 'race'],
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
			storeField: 'buffs',
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
			storeField: 'raid:debuffs',
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
