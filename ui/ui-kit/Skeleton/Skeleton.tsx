import clsx, { type ClassValue } from 'clsx';

export interface SkeletonProps {
	className?: ClassValue;
}

export const Skeleton = ({ className }: SkeletonProps) => <span className={clsx('ui-skeleton', className)} />;
