import clsx, { type ClassValue } from 'clsx';

export interface SpinnerProps {
	size?: 'sm' | 'md';
	className?: ClassValue;
}

const SIZE = {
	md: 'w-(--loader-width,120px) h-(--loader-height,120px) border-[calc(var(--loader-width,120px)/7.5)]',
	sm: 'w-(--loader-width,60px) h-(--loader-height,60px) border-[calc(var(--loader-width,60px)/7.5)]',
} as const;

export const Spinner = ({ size = 'md', className }: SpinnerProps) => (
	<div data-testid="loader" className={clsx('loader', 'rounded-full border-spinner-track border-t-spinner animate-spin', SIZE[size], className)} />
);
