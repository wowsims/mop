import { Field } from '@base-ui/react/field';
import clsx, { type ClassValue } from 'clsx';
import { forwardRef } from 'react';

export interface SelectProps extends Omit<Field.Control.Props, 'className' | 'render'> {
	className?: ClassValue;
}

export const Select = forwardRef<HTMLElement, SelectProps>(({ className, ...props }, ref) => (
	<Field.Control render={<select />} ref={ref} className={clsx('ui-select', className)} {...props} />
));
Select.displayName = 'Select';
