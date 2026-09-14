import clsx, { type ClassValue } from 'clsx';
import { type ComponentPropsWithoutRef, type ElementType, type ReactNode } from 'react';

export interface FieldLabelProps extends Omit<ComponentPropsWithoutRef<'label'>, 'className' | 'id' | 'htmlFor'> {
	as?: 'label' | 'span' | 'div';
	htmlFor?: string;
	id?: string;
	className?: ClassValue;
	children?: ReactNode;
	testId?: string;
}

export const FieldLabel = ({ as = 'label', htmlFor, id, className, children, testId, ...rest }: FieldLabelProps) => {
	const Tag = as as ElementType;
	return (
		<Tag htmlFor={as === 'label' ? htmlFor : undefined} id={id} className={clsx('ui-field-label', className)} data-testid={testId} {...rest}>
			{children}
		</Tag>
	);
};
