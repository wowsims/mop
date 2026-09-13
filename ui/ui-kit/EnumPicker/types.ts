import type { ControlledConfig, InputConfig } from '@ui-kit/input';

export interface EnumValueConfig {
	name: string;
	value: number;
	tooltip?: string;
}

export interface EnumPickerConfig<ModObject> extends InputConfig<ModObject, number> {
	id: string;
	values: Array<EnumValueConfig>;
}

export type ControlledEnumPickerConfig<ModObject> = ControlledConfig<ModObject, number> & { id: string; values: Array<EnumValueConfig> };

export type AnyEnumPickerConfig<ModObject> = EnumPickerConfig<ModObject> | ControlledEnumPickerConfig<ModObject>;
