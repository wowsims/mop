import { Field } from '@base-ui/react/field';
import { Input } from '@base-ui/react/input';
import { Icon } from '@ui-kit/Icon';
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
		<Field.Root className={clsx('input-root', grow === false && 'flex-none')} data-testid="search-bar-root">
			{label && (
				<Field.Label htmlFor={id} className="form-label">
					{label}
				</Field.Label>
			)}
			<div className={clsx('relative flex items-center', grow === false && 'flex-none')}>
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
					<button
						type="button"
						className={clsx('absolute right-0 px-2 py-0 btn btn-link', clearClassName)}
						data-testid="search-bar-clear-btn"
						aria-label={clearLabel}
						onClick={handleClear}>
						<Icon name="times" />
					</button>
				)}
			</div>
			{children}
		</Field.Root>
	);
};
