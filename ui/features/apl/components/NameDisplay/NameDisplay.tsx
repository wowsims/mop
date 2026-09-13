import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';

export interface NameDisplayProps {
	name: string;
	onRename: () => void;
}

/** A name with a pencil beside it — an action group's, a value variable's and a placeholder's. */
export const NameDisplay = ({ name, onRename }: NameDisplayProps) => (
	<div className="apl-name-display">
		<span className="apl-name-value">{name}</span>
		<Button
			variant="unstyled"
			className="p-0 border-0 rounded-none text-sm leading-none font-normal text-center align-middle no-underline cursor-pointer select-none transition-[color,background-color,border-color] duration-150 ease-in-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-65 text-link hover:text-link-hover focus-visible:shadow-focus-link disabled:text-gray-600 apl-name-rename"
			onClick={onRename}>
			<Icon name="pencil-alt" />
		</Button>
	</div>
);
