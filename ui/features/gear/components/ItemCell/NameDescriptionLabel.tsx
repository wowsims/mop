import type { ClassValue } from 'clsx';
import clsx from 'clsx';

export interface NameDescriptionLabelProps {
	nameDescription: string;
	className?: ClassValue;
}

export const NameDescriptionLabel = ({ nameDescription, className }: NameDescriptionLabelProps) => (
	<small className={clsx('heroic-label', className)}>({nameDescription})</small>
);
