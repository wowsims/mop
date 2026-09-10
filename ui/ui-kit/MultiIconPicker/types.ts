import type { Player } from '@sim/player/player';
import type { ActionId } from '@sim/proto/action_id';
import type { IconPickerConfig } from '@ui-kit/IconPicker/types';

export interface MultiIconPickerItemConfig<ModObject> extends IconPickerConfig<ModObject, any> {}

export interface MultiIconPickerConfig<ModObject> {
	inputs: Array<MultiIconPickerItemConfig<ModObject>>;
	label?: string;
	categoryId?: ActionId;
	showWhen?: (obj: Player<any>) => boolean;
}
