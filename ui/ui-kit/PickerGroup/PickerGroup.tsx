import clsx, { type ClassValue } from 'clsx';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';

export interface PickerGroupProps extends Omit<ComponentPropsWithoutRef<'div'>, 'className'> {
	className?: ClassValue;
}

export const PickerGroup = forwardRef<HTMLDivElement, PickerGroupProps>(({ className, ...props }, ref) => (
	<div ref={ref} className={clsx('picker-group ui-picker-group', className)} {...props} />
));
PickerGroup.displayName = 'PickerGroup';
