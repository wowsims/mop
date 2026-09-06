import type { IconPickerStatOption } from '@features/settings/model/stat_options';
import { usePlayer } from '@features/SimHostContext';
import { IconPicker } from '@ui-kit/IconPicker';

export interface StatOptionIconsProps {
	/** Already filtered through `relevantStatOptions` — this renders whatever it is given. */
	options: ReadonlyArray<IconPickerStatOption>;
}

/**
 * A row of icon toggles built from a `PickerStatOption` list: the shape every buffs-and-debuffs
 * section shares, of which the two external-cooldown blocks are the simplest instances.
 *
 * Typed to `IconPickerStatOption` rather than the wider `PickerStatOptions` union on purpose. The
 * other two members name pickers that have no React port yet — `MultiIconPicker` and
 * `IconEnumPicker` — and a runtime dispatch that returned `null` for them would render a section
 * silently short. Widen this to a dispatch when the first of those ports; until then the type is
 * what stops Buffs and Debuffs being wired up half-working.
 */
export const StatOptionIcons = ({ options }: StatOptionIconsProps) => {
	const player = usePlayer();
	return (
		<>
			{options.map((option, index) => (
				// The list is derived from a module-level constant and never reorders, so the index is
				// stable — and the configs carry no id of their own to key on.
				<IconPicker key={index} modObject={player} config={option.config} />
			))}
		</>
	);
};
