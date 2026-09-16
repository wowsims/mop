import { Field } from '@base-ui/react/field';
import { Input } from '@base-ui/react/input';
import { Button } from '@ui-kit/Button';
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
		<Field.Root className={clsx('ui-field', grow === false && 'flex-none')} data-testid="search-bar-root" data-input-root="">
			{label && (
				<Field.Label htmlFor={id} className="ui-field-label">
					{label}
				</Field.Label>
			)}
			<div className={clsx('relative flex', grow === false ? 'flex-none' : 'w-full')}>
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
				{clearable && draft.length > 0 && (
					<Button
						variant="link"
						size="inline"
						className={clsx('absolute inset-y-0 right-0 flex items-center', clearClassName)}
						data-testid="search-bar-clear-btn"
						aria-label={clearLabel}
						onClick={handleClear}>
						<Icon name="times" />
					</Button>
				)}
			</div>
			{children}
		</Field.Root>
	);
};
