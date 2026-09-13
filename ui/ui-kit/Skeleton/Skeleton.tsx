import clsx, { type ClassValue } from 'clsx';

export interface SkeletonProps {
	className?: ClassValue;
}

export const Skeleton = ({ className }: SkeletonProps) => (
	<span
		className={clsx(
			'inline-block align-middle w-14 h-[0.85em] rounded-xs bg-skeleton bg-[length:200%_100%] animate-skeleton motion-reduce:animate-none',
			className,
		)}
	/>
);
