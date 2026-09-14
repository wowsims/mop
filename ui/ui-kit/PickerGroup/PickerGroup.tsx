import clsx, { type ClassValue } from 'clsx';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';

export interface PickerGroupProps extends Omit<ComponentPropsWithoutRef<'div'>, 'className'> {
	className?: ClassValue;
}

export const PickerGroup = forwardRef<HTMLDivElement, PickerGroupProps>(({ className, ...props }, ref) => {
	const classes = clsx('picker-group ui-picker-group', className);
	return <div ref={ref} className={clsx(classes, classes.includes('icon-group') && 'ui-picker-group-icons')} {...props} />;
});
PickerGroup.displayName = 'PickerGroup';
