import { Menu } from '@base-ui/react/menu';
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
}

/**
 * Everything inside a dropdown's root: the trigger, the menu and the one tooltip its options share.
 *
 * It is its own component because the root element differs by caller and nothing else does —
 * `DropdownPicker` owns a plain `div`, while a bound picker's root is `PickerShell`'s `Field.Root`
 * so that binding a dropdown adds no element. Forking the menu instead would have put a wrapper
 * div inside every bound picker.
 */
export const DropdownMenu = <V,>({ id, options, value, onChange, equals, defaultLabel, hideLabelWhenDefault, side, positionMethod }: DropdownMenuProps<V>) => {
	// null is Base UI's "not resolved yet"; anything else falls back to <body>, which is outside `.sim-ui` and its theme.
	const [slot, setSlot] = useState<HTMLDivElement | null>(null);
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
				<Menu.Trigger id={id} className={clsx('dropdown-picker-button', 'btn', 'dropdown-toggle', selected?.className)}>
					{selected ? (
						<>
							{selected.icon}
							{!hideLabel && selected.label}
						</>
					) : (
						defaultLabel
					)}
				</Menu.Trigger>
				{/* This slot holds the place after the button that a portal aimed at the root cannot: Base UI appends its element in a later commit than React places the root's own children. */}
				<div className="dropdown-picker-slot" ref={setSlot} />
				<Menu.Portal container={slot} className="dropdown-picker-portal">
					<Menu.Positioner
						align="start"
						side={side}
						positionMethod={positionMethod}
						sideOffset={BOOTSTRAP_DROPDOWN_OFFSET}
						className="dropdown-picker-positioner">
						<Menu.Popup className="dropdown-picker-menu">
							<Menu.RadioGroup
								render={<ul />}
								className="dropdown-picker-list"
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
					className="dropdown-tooltip"
					render={({ activeAnchor }) => {
						const content = activeAnchor?.getAttribute('data-tooltip-content');
						return content ? <LocaleHtml html={content} /> : null;
					}}
				/>
			)}
		</>
	);
};
