import './IconEnumPicker.scss';

import { Menu } from '@base-ui/react/menu';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useInput } from '@ui-kit/hooks/useInput';
import { type IconEnumPickerConfig, IconEnumPickerDirection, type IconEnumValueConfig } from '@ui-kit/pickers/icon_enum_picker';
import { PickerShell } from '@ui-kit/PickerShell';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useEffect, useId, useRef, useState } from 'react';

import { IconEnumOption } from './IconEnumOption';
import { actionIconStyle, iconEnumPickerShown, iconStyleOf } from './utils';

export interface IconEnumPickerProps<ModObject, T> {
	modObject: ModObject;
	config: IconEnumPickerConfig<ModObject, T>;
}

export const IconEnumPicker = <ModObject, T>({ modObject, config }: IconEnumPickerProps<ModObject, T>) => {
	// null is Base UI's "not resolved yet"; anything else falls back to <body>.
	const [slot, setSlot] = useState<HTMLDivElement | null>(null);
	const { value, setValue, disabled, revision } = useInput(modObject, config);
	const tooltipId = useId();

	const shows = (valueConfig: IconEnumValueConfig<ModObject, T>) => !valueConfig.showWhen || valueConfig.showWhen(modObject);

	const hidden = !iconEnumPickerShown(config, modObject);

	const selected = config.values.find(valueConfig => config.equals(valueConfig.value, value));
	const selectedHidden = !!selected && !shows(selected);
	const backupId = selected ? undefined : config.backupIconUrl?.(value);
	const { iconUrl, href } = useActionId(selectedHidden ? undefined : (selected?.actionId ?? backupId));

	const active = !disabled && !config.equals(value, config.zeroValue);

	const storedValue = useRef<T | undefined>(undefined);
	const lastRevision = useRef<number | null>(null);
	useEffect(() => {
		if (lastRevision.current === revision) return;
		const construction = lastRevision.current === null;
		lastRevision.current = revision;
		if (construction) return;

		let current = value;
		if (hidden) {
			if (storedValue.current === undefined) {
				storedValue.current = value;
				current = config.zeroValue;
				setValue(current);
			}
		} else if (storedValue.current !== undefined) {
			const restored = storedValue.current;
			storedValue.current = undefined;
			if (config.equals(value, config.zeroValue)) {
				current = restored;
				setValue(current);
			}
		}

		if (config.values.some(valueConfig => !shows(valueConfig) && valueConfig.value === current)) setValue(config.zeroValue);
	});

	const disabledAttribute = (disabled ? { disabled: true } : {}) as Record<string, boolean>;

	const horizontal = config.direction === IconEnumPickerDirection.Horizontal;
	const tooltips = !!config.tooltip || config.values.some(valueConfig => !!valueConfig.tooltip);

	return (
		<PickerShell
			config={config as typeof config & { id: string }}
			cssClass={clsx('icon-enum-picker-root', 'icon-picker', horizontal ? 'dropend' : 'dropdown')}
			hidden={hidden}
			disabled={disabled}>
			<Menu.Root modal={false}>
				<Menu.Trigger
					nativeButton={false}
					// No href when nothing is selected: React refuses javascript:void(0), and nativeButton={false} keeps the anchor focusable.
					render={<a href={selectedHidden ? undefined : href || undefined} {...disabledAttribute} />}
					openOnHover
					delay={0}
					className={clsx('icon-picker-button', active && 'active')}
					style={selectedHidden ? undefined : selected ? iconStyleOf(selected, iconUrl) : backupId ? actionIconStyle(iconUrl) : undefined}
					data-whtticon="false"
					data-disable-wowhead-touch-tooltip="true"
					{...tooltipAnchorProps(config.tooltip ? tooltipId : undefined, config.tooltip)}
				/>
				<div className="icon-enum-picker-slot" ref={setSlot} />
				<Menu.Portal container={slot} keepMounted className="icon-enum-picker-portal">
					<Menu.Positioner side={horizontal ? 'right' : 'bottom'} align="start" sideOffset={-1} className="icon-enum-picker-positioner">
						<Menu.Popup
							render={<ul />}
							className="icon-enum-picker-menu"
							style={{
								gridTemplateColumns: config.numColumns ? `repeat(${config.numColumns}, 1fr)` : undefined,
								gridAutoFlow: horizontal ? 'column' : undefined,
							}}>
							{config.values.map((valueConfig, index) => (
								<IconEnumOption
									key={index}
									valueConfig={valueConfig}
									hidden={!shows(valueConfig)}
									tooltipId={tooltipId}
									onSelect={() => {
										storedValue.current = undefined;
										setValue(valueConfig.value);
									}}
								/>
							))}
						</Menu.Popup>
					</Menu.Positioner>
				</Menu.Portal>
			</Menu.Root>
			<label className="form-label" style={{ display: selected?.text === undefined ? 'none' : 'block' }}>
				{selected?.text}
			</label>
			{tooltips && <Tooltip id={tooltipId} />}
		</PickerShell>
	);
};
