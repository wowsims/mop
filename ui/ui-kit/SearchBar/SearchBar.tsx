import { Input } from '@base-ui/react/input';
import { FieldShell } from '@ui-kit/FieldShell';
import clsx from 'clsx';
import { type ReactNode, useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

export interface SearchBarProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	label?: string;
	id?: string;
	debounceMs?: number;
	clearable?: boolean;
	clearLabel?: string;
	/** Lands on the clear button, for a caller whose stylesheet already names it. */
	clearClassName?: string;
	autoFocus?: boolean;
	autoComplete?: 'on' | 'off';
	className?: string;
	grow?: boolean;
	/** Rendered after the input group, inside the field — for a results list positioned against the same box. */
	children?: ReactNode;
	inputTestId?: string;
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
	clearClassName,
	autoFocus,
	autoComplete,
	className,
	grow = true,
	children,
	inputTestId,
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
		<FieldShell
			label={label}
			id={id}
			grow={grow}
			rootTestId="search-bar-root"
			showClear={clearable && draft.length > 0}
			clearLabel={clearLabel}
			clearClassName={clearClassName}
			clearTestId="search-bar-clear-btn"
			onClear={handleClear}
			after={children}>
			<Input
				id={id}
				type="text"
				data-testid={inputTestId}
				className={clsx('ui-input', className)}
				placeholder={placeholder}
				autoFocus={autoFocus}
				autoComplete={autoComplete}
				value={draft}
				onChange={event => handleInput(event.target.value)}
			/>
		</FieldShell>
	);
};
