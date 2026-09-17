import { Menu } from '@base-ui/react/menu';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useInput } from '@ui-kit/hooks/useInput';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';
import { PickerShell } from '@ui-kit/PickerShell';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useEffect, useId, useRef } from 'react';

import { IconEnumOption } from './IconEnumOption';
import { type IconEnumPickerConfig, IconEnumPickerDirection, type IconEnumValueConfig } from './types';
import { actionIconStyle, iconEnumPickerShown, iconStyleOf } from './utils';

export interface IconEnumPickerProps<ModObject, T> {
	modObject: ModObject;
	config: IconEnumPickerConfig<ModObject, T>;
}

export const IconEnumPicker = <ModObject, T>({ modObject, config }: IconEnumPickerProps<ModObject, T>) => {
	const portalContainer = usePortalContainer();
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
			className="ui-icon-field relative"
			testId="icon-enum-picker-root"
			iconField
			hidden={hidden}
			disabled={disabled}>
			<Menu.Root modal={false}>
				<Menu.Trigger
					nativeButton={false}
					// No href when nothing is selected: React refuses javascript:void(0), and nativeButton={false} keeps the anchor focusable.
					render={<a href={selectedHidden ? undefined : href || undefined} {...disabledAttribute} />}
					openOnHover
					delay={0}
					className="ui-icon-picker-swatch transition-none"
					data-testid="icon-enum-picker-button"
					data-active={active ? '' : undefined}
					style={selectedHidden ? undefined : selected ? iconStyleOf(selected, iconUrl) : backupId ? actionIconStyle(iconUrl) : undefined}
					data-whtticon="false"
					data-disable-wowhead-touch-tooltip="true"
					{...tooltipAnchorProps(config.tooltip ? tooltipId : undefined, config.tooltip)}
				/>
				<Menu.Portal container={portalContainer ?? undefined} className="contents" data-testid="icon-enum-picker-portal">
					{/* `positionMethod="fixed"`, not the default `absolute`: Base UI renders the positioner `position: fixed` until it has a position, so Floating UI measures it against the viewport, and the switch to `absolute` then reads those viewport coordinates against whatever ancestor is `position: relative`. */}
					<Menu.Positioner
						side={horizontal ? 'right' : 'bottom'}
						align="start"
						sideOffset={-1}
						positionMethod="fixed"
						className="z-dropdown"
						data-testid="icon-enum-picker-positioner">
						<Menu.Popup
							render={<ul />}
							className="m-0 grid list-none border-0 bg-grey p-0"
							data-testid="icon-enum-picker-menu"
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
			<label
				className="ui-field-label"
				data-testid="form-label"
				title={selected?.text}
				style={{ display: selected?.text === undefined ? 'none' : 'block' }}>
				{selected?.text}
			</label>
			{tooltips && <Tooltip id={tooltipId} />}
		</PickerShell>
	);
};
