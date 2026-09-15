import { Menu } from '@base-ui/react/menu';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';
import { LocaleHtml, Tooltip } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId, useMemo, useState } from 'react';

import { DropdownMenuItems } from './DropdownMenuItems';
import type { DropdownOption } from './types';
import { buildMenuTree } from './utils';

// Offsets the menu 2px from the toggle.
const BOOTSTRAP_DROPDOWN_OFFSET = 2;

export interface DropdownMenuProps<V> {
	id?: string;
	options: Array<DropdownOption<V>>;
	value: V | undefined;
	onChange: (value: V) => void;
	equals: (a: V | undefined, b: V | undefined) => boolean;
	defaultLabel: React.ReactNode;
	hideLabelWhenDefault?: (value: V) => boolean;
	side?: Menu.Positioner.Props['side'];
	positionMethod?: Menu.Positioner.Props['positionMethod'];
	triggerClassName?: string;
}

/**
 * Everything inside a dropdown's root: the trigger, the menu and the one tooltip its options share.
 *
 * It is its own component because the root element differs by caller and nothing else does —
 * `DropdownPicker` owns a plain `div`, while a bound picker's root is `PickerShell`'s `Field.Root`
 * so that binding a dropdown adds no element. Forking the menu instead would have put a wrapper
 * div inside every bound picker.
 */
export const DropdownMenu = <V,>({
	id,
	options,
	value,
	onChange,
	equals,
	defaultLabel,
	hideLabelWhenDefault,
	side,
	positionMethod,
	triggerClassName,
}: DropdownMenuProps<V>) => {
	const portalContainer = usePortalContainer();
	const [open, setOpen] = useState(false);
	const tooltipId = `${useId()}-option`;

	// The index, not the value, is what the radio group compares: an option value is an object here, and Base UI matches a selected radio by identity.
	const selectedIndex = options.findIndex(option => equals(option.value, value));
	const selected = options[selectedIndex] as DropdownOption<V> | undefined;
	const hideLabel = !!selected && !!hideLabelWhenDefault?.(selected.value);

	const entries = useMemo(() => buildMenuTree(options, equals), [options, equals]);
	// The shared tooltip below anchors on the options, which exist only while the menu is open, so it mounts and unmounts with them.
	const hasTooltips = open && options.some(option => option.tooltip !== undefined);

	return (
		<>
			<Menu.Root open={open} onOpenChange={setOpen} modal={false}>
				<Menu.Trigger
					id={id}
					className={clsx(
						'ui-dropdown-trigger',
						triggerClassName,
						'text-foreground',
						!selected?.className && 'hover:text-white/80',
						selected?.className,
					)}
					data-testid="dropdown-picker-button">
					{selected ? (
						<>
							{selected.icon}
							{!hideLabel && selected.label}
						</>
					) : (
						defaultLabel
					)}
				</Menu.Trigger>
				<Menu.Portal container={portalContainer ?? undefined} className="contents" data-testid="dropdown-picker-portal">
					<Menu.Positioner
						align="start"
						side={side}
						positionMethod={positionMethod}
						sideOffset={BOOTSTRAP_DROPDOWN_OFFSET}
						className="ui-menu-positioner"
						data-testid="dropdown-picker-positioner">
						<Menu.Popup className="ui-menu" data-testid="dropdown-picker-menu">
							<Menu.RadioGroup
								render={<ul />}
								className="m-0 list-none p-0"
								data-testid="dropdown-picker-list"
								value={selectedIndex}
								onValueChange={(index: number) => onChange(options[index].value)}>
								{/* Built on open and dropped on close. */}
								{open && <DropdownMenuItems entries={entries} tooltipId={tooltipId} onSelect={index => onChange(options[index].value)} />}
							</Menu.RadioGroup>
						</Menu.Popup>
					</Menu.Positioner>
				</Menu.Portal>
			</Menu.Root>
			{/*
			 * One tooltip serves every option: an APL kind menu opens sixty at once, and the model
			 * layer builds each body as HTML (`<p>short</p> full`), which is why this is the one place
			 * the picker sets inner HTML. The content is authored in `features/apl/model/`, never by a
			 * user.
			 */}
			{hasTooltips && (
				<Tooltip
					id={tooltipId}
					maxWidth="max-w-tooltip-dropdown"
					align="start"
					render={({ activeAnchor }) => {
						const content = activeAnchor?.getAttribute('data-tooltip-content');
						return content ? <LocaleHtml html={content} /> : null;
					}}
				/>
			)}
		</>
	);
};
