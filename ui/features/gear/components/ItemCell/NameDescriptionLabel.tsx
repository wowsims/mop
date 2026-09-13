import type { ClassValue } from 'clsx';
import clsx from 'clsx';

export interface NameDescriptionLabelProps {
	nameDescription: string;
	className?: ClassValue;
	flush?: boolean;
}

export const NameDescriptionLabel = ({ nameDescription, className, flush }: NameDescriptionLabelProps) => (
	<small className={clsx('heroic-label text-quality-uncommon text-ui', flush ? 'ml-0' : 'ml-1', className)}>({nameDescription})</small>
);
