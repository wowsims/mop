import clsx, { type ClassValue } from 'clsx';

export interface SpinnerProps {
	size?: 'sm' | 'md';
	className?: ClassValue;
}

export const Spinner = ({ size = 'md', className }: SpinnerProps) => (
	<div data-testid="loader" className={clsx('ui-spinner rounded-full', size === 'sm' && 'ui-spinner-sm', className)} />
);
