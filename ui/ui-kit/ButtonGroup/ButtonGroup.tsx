import clsx from 'clsx';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';

const BASE = '';

export interface ButtonGroupProps extends ComponentPropsWithoutRef<'div'> {
	size?: 'sm';
}

export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(({ size, role = 'group', className, children, ...props }, ref) => (
	<div ref={ref} role={role} data-size={size} className={clsx(BASE, className)} {...props}>
		{children}
	</div>
));
ButtonGroup.displayName = 'ButtonGroup';
