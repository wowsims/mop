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
		<Button variant="link" className="apl-name-rename" onClick={onRename}>
			<Icon name="pencil-alt" />
		</Button>
	</div>
);
