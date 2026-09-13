import clsx from 'clsx';

export interface RotationFabChipProps {
	label: string;
	shown: boolean;
	/** One chip per group is in the tab order; the arrow keys move it. */
	focused: boolean;
	onToggle: () => void;
	onFocus: () => void;
}

export const RotationFabChip = ({ label, shown, focused, onToggle, onFocus }: RotationFabChipProps) => (
	<button
		type="button"
		className={clsx('rotation-fab-chip saved-data-set-chip badge rounded-full', shown && 'active')}
		data-testid="saved-data-set-chip"
		data-active={shown ? '' : undefined}
		role="switch"
		aria-checked={shown}
		tabIndex={focused ? 0 : -1}
		onClick={onToggle}
		onFocus={onFocus}>
		<span className="saved-data-set-name" data-testid="saved-data-set-name">
			{label}
		</span>
	</button>
);
