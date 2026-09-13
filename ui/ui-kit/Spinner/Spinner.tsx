import clsx, { type ClassValue } from 'clsx';

export interface SpinnerProps {
	size?: 'sm' | 'md';
	className?: ClassValue;
}

const SIZE = {
	md: 'w-[var(--loader-width,120px)] h-[var(--loader-height,120px)] border-[calc(var(--loader-width,120px)/7.5)]',
	sm: 'w-[var(--loader-width,60px)] h-[var(--loader-height,60px)] border-[calc(var(--loader-width,60px)/7.5)]',
} as const;

export const Spinner = ({ size = 'md', className }: SpinnerProps) => (
	<div data-testid="loader" className={clsx('loader', 'rounded-[50%] border-[#f3f3f3] border-t-[#3498db] animate-spin', SIZE[size], className)} />
);
