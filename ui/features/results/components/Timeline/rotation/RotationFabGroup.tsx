import type { KeyboardEvent } from 'react';
import { useState } from 'react';

import type { ContentRow } from '../../../view/timeline/rotation/model';
import { RotationFabChip } from './RotationFabChip';

export interface RotationFabGroupProps {
	title: string;
	rows: ReadonlyArray<ContentRow>;
	hidden: ReadonlySet<string>;
	onToggle: (key: string) => void;
}

export const RotationFabGroup = ({ title, rows, hidden, onToggle }: RotationFabGroupProps) => {
	// A roving tabindex: the group is one tab stop and the arrow keys walk it. Focus is what carries
	// the move, so a chip reached by any other route claims the tab stop too.
	const [focusedKey, setFocusedKey] = useState(rows[0].key);
	const focused = rows.some(row => row.key === focusedKey) ? focusedKey : rows[0].key;

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		const chips = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.rotation-fab-chip')];
		const at = chips.indexOf((event.target as Element).closest<HTMLButtonElement>('.rotation-fab-chip')!);
		if (at < 0) return;
		chips[(at + (event.key === 'ArrowRight' ? 1 : chips.length - 1)) % chips.length].focus();
		event.preventDefault();
	};

	return (
		<div className="rotation-fab-group">
			<div className="rotation-fab-group-title">{title}</div>
			<div className="rotation-fab-group-chips" onKeyDown={onKeyDown}>
				{rows.map(row => (
					<RotationFabChip
						key={row.key}
						label={row.label}
						shown={!hidden.has(row.key)}
						focused={row.key === focused}
						onToggle={() => onToggle(row.key)}
						onFocus={() => setFocusedKey(row.key)}
					/>
				))}
			</div>
		</div>
	);
};
