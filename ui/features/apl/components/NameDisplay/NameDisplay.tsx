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
		<Button
			variant="unstyled"
			className="p-0 border-0 rounded-none text-sm leading-none font-normal text-center align-middle no-underline cursor-pointer select-none transition-[color,background-color,border-color] duration-150 ease-in-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-65 text-link hover:text-link-hover focus-visible:shadow-focus-link disabled:text-gray-600"
			onClick={onRename}>
			<Icon name="pencil-alt" />
		</Button>
	</div>
);
