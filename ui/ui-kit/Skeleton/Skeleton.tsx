import clsx, { type ClassValue } from 'clsx';

export interface SkeletonProps {
	className?: ClassValue;
}

export const Skeleton = ({ className }: SkeletonProps) => (
	<span
		className={clsx(
			'inline-block align-middle w-14 h-[0.85em] rounded-[3px] bg-[linear-gradient(90deg,rgb(255_255_255/8%)_25%,rgb(255_255_255/18%)_50%,rgb(255_255_255/8%)_75%)] bg-[length:200%_100%] animate-skeleton motion-reduce:animate-none',
			className,
		)}
	/>
);
