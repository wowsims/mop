import { Chip } from '@ui-kit/Chip';

export interface RotationFabChipProps {
	label: string;
	shown: boolean;
	/** One chip per group is in the tab order; the arrow keys move it. */
	focused: boolean;
	onToggle: () => void;
	onFocus: () => void;
}

export const RotationFabChip = ({ label, shown, focused, onToggle, onFocus }: RotationFabChipProps) => (
	<Chip
		as="button"
		nameAs="span"
		testId="rotation-fab-chip"
		label={label}
		active={shown}
		rootProps={{
			type: 'button',
			role: 'switch',
			'aria-checked': shown,
			tabIndex: focused ? 0 : -1,
			onClick: onToggle,
			onFocus,
		}}
	/>
);
