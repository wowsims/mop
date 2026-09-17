import { Faction, Stat } from '@generated/proto/common';
import { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import type { IndividualSimHost } from '@sim/sim_host';
import type { IconEnumPickerConfig } from '@ui-kit/IconEnumPicker/types';
import type { IconPickerConfig } from '@ui-kit/IconPicker/types';
import type { MultiIconPickerConfig } from '@ui-kit/MultiIconPicker/types';

export interface ActionInputConfig<T> {
	actionId: ActionId;
	value: T;
	faction?: Faction;
	showWhen?: (player: Player<any>) => boolean;
}

export interface StatOption {
	stats: Array<Stat>;
}

export interface ItemStatOption<T> extends StatOption {
	config: ActionInputConfig<T>;
}

export interface PickerStatOption<ConfigType> extends StatOption {
	config: ConfigType;
}

export interface IconPickerStatOption extends PickerStatOption<IconPickerConfig<Player<any>, any>> {}

export interface MultiIconPickerStatOption extends PickerStatOption<MultiIconPickerConfig<Player<any>>> {}

export interface IconEnumPickerStatOption extends PickerStatOption<IconEnumPickerConfig<Player<any>, any>> {}

export type ItemStatOptions<T> = ItemStatOption<T>;
export type PickerStatOptions = IconPickerStatOption | MultiIconPickerStatOption | IconEnumPickerStatOption;
export type RenderableStatOptions = IconPickerStatOption | MultiIconPickerStatOption;
export type StatOptions<T, Options extends ItemStatOptions<T> | PickerStatOptions> = Array<Options>;

export function relevantStatOptions<T, OptionsType extends ItemStatOptions<T> | PickerStatOptions>(
	options: StatOptions<T, OptionsType>,
	simUI: IndividualSimHost<any>,
): StatOptions<T, OptionsType> {
	return options
		.filter(
			option =>
				option.stats.length == 0 ||
				option.stats.some(stat => simUI.individualConfig.epStats.includes(stat)) ||
				simUI.individualConfig.includeBuffDebuffInputs.includes(option.config),
		)
		.filter(option => !simUI.individualConfig.excludeBuffDebuffInputs.includes(option.config));
}
