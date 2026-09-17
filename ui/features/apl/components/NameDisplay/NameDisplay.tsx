import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';

export interface NameDisplayProps {
	name: string;
	onRename: () => void;
	compact?: boolean;
}

/** A name with a pencil beside it — an action group's, a value variable's and a placeholder's. */
export const NameDisplay = ({ name, onRename, compact }: NameDisplayProps) => (
	<div className="flex items-center gap-2">
		<span className={clsx('font-bold', compact && 'text-sm')}>{name}</span>
		<Button variant="link" className="leading-none" onClick={onRename}>
			<Icon name="pencil-alt" />
		</Button>
	</div>
);
