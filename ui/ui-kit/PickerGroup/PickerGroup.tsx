import clsx, { type ClassValue } from 'clsx';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';

export interface PickerGroupProps extends Omit<ComponentPropsWithoutRef<'div'>, 'className'> {
	className?: ClassValue;
	variant?: 'icons';
}

export const PickerGroup = forwardRef<HTMLDivElement, PickerGroupProps>(({ className, variant, ...props }, ref) => {
	const classes = clsx('picker-group ui-picker-group', className);
	return <div ref={ref} className={clsx(classes, variant === 'icons' && 'ui-picker-group-icons')} {...props} />;
});
PickerGroup.displayName = 'PickerGroup';
