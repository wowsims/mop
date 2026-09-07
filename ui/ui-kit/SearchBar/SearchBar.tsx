import { Field } from '@base-ui/react/field';
import { Input } from '@base-ui/react/input';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import './SearchBar.scss';

export interface SearchBarProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	label?: string;
	id?: string;
	debounceMs?: number;
	clearable?: boolean;
	clearLabel?: string;
	autoFocus?: boolean;
	autoComplete?: 'on' | 'off';
	className?: string;
}

export const SearchBar = ({
	value,
	onChange,
	placeholder,
	label,
	id,
	debounceMs = 0,
	clearable = false,
	clearLabel,
	autoFocus,
	autoComplete,
	className,
}: SearchBarProps) => {
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);

	useDebounce(
		() => {
			if (debounceMs > 0) onChange(draft);
		},
		debounceMs,
		[draft],
	);

	const handleInput = (next: string) => {
		setDraft(next);
		if (debounceMs <= 0) onChange(next);
	};

	const handleClear = () => {
		setDraft('');
		onChange('');
	};

	return (
		<Field.Root className="input-root search-bar-root">
			{label && (
				<Field.Label htmlFor={id} className="form-label">
					{label}
				</Field.Label>
			)}
			<div className="search-bar-input-group">
				<Input
					id={id}
					type="text"
					className={clsx('search-bar-input form-control', className)}
					placeholder={placeholder}
					autoFocus={autoFocus}
					autoComplete={autoComplete}
					value={draft}
					onChange={event => handleInput(event.target.value)}
				/>
				{clearable && draft.length > 0 && (
					<button type="button" className="search-bar-clear-btn btn btn-link" aria-label={clearLabel} onClick={handleClear}>
						<Icon name="times" />
					</button>
				)}
			</div>
		</Field.Root>
	);
};
