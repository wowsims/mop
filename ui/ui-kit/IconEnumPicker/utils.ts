import type { IconEnumPickerConfig, IconEnumValueConfig } from '@ui-kit/pickers/icon_enum_picker';
import type { CSSProperties } from 'react';

export const iconEnumPickerShown = <ModObject, T>(config: IconEnumPickerConfig<ModObject, T>, modObject: ModObject): boolean =>
	(!config.showWhen || config.showWhen(modObject)) &&
	config.values.some(valueConfig => !!valueConfig.actionId && (!valueConfig.showWhen || valueConfig.showWhen(modObject)));

export const actionIconStyle = (iconUrl: string): CSSProperties | undefined => (iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined);

export const iconStyleOf = <ModObject, T>(valueConfig: IconEnumValueConfig<ModObject, T>, filledIconUrl: string): CSSProperties | undefined => {
	if (valueConfig.actionId) return actionIconStyle(filledIconUrl);
	if (valueConfig.iconUrl) return { backgroundImage: `url(${valueConfig.iconUrl})`, filter: 'grayscale(1)' };
	return { backgroundColor: valueConfig.color };
};
