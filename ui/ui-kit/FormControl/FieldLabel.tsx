import clsx, { type ClassValue } from 'clsx';
import { type ElementType, type ReactNode } from 'react';

export interface FieldLabelProps {
	as?: 'label' | 'span' | 'div';
	htmlFor?: string;
	id?: string;
	className?: ClassValue;
	children?: ReactNode;
}

export const FieldLabel = ({ as = 'label', htmlFor, id, className, children }: FieldLabelProps) => {
	const Tag = as as ElementType;
	return (
		<Tag htmlFor={as === 'label' ? htmlFor : undefined} id={id} className={clsx('inline-block mb-1 text-ui font-normal', className)}>
			{children}
		</Tag>
	);
};
