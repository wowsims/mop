import { Field } from '@base-ui/react/field';
import clsx, { type ClassValue } from 'clsx';
import { forwardRef } from 'react';

import { SELECT_CLASSES } from './classes';

export interface SelectProps extends Omit<Field.Control.Props, 'className' | 'render'> {
	className?: ClassValue;
}

export const Select = forwardRef<HTMLElement, SelectProps>(({ className, ...props }, ref) => (
	<Field.Control render={<select />} ref={ref} className={clsx(SELECT_CLASSES, className)} {...props} />
));
Select.displayName = 'Select';
