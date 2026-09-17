import { Field } from '@base-ui/react/field';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface FieldShellProps {
	label?: string;
	id?: string;
	grow?: boolean;
	rootTestId?: string;
	showClear?: boolean;
	clearLabel?: string;
	clearClassName?: string;
	clearTestId?: string;
	onClear?: () => void;
	children?: ReactNode;
	after?: ReactNode;
}

export const FieldShell = ({ label, id, grow, rootTestId, showClear, clearLabel, clearClassName, clearTestId, onClear, children, after }: FieldShellProps) => (
	<Field.Root className={clsx('ui-field', grow === false && 'flex-none')} data-testid={rootTestId} data-input-root="">
		{label && (
			<Field.Label htmlFor={id} className="ui-field-label">
				{label}
			</Field.Label>
		)}
		<div className={clsx('relative flex', grow === false ? 'flex-none' : 'w-full')}>
			{children}
			{showClear && (
				<Button
					variant="link"
					size="inline"
					className={clsx('absolute inset-y-0 right-0 flex items-center', clearClassName)}
					data-testid={clearTestId}
					aria-label={clearLabel}
					onClick={onClear}>
					<Icon name="times" />
				</Button>
			)}
		</div>
		{after}
	</Field.Root>
);
