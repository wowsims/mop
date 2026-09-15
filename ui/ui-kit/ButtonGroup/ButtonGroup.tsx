import { type ComponentPropsWithoutRef, forwardRef } from 'react';

export interface ButtonGroupProps extends ComponentPropsWithoutRef<'div'> {
	size?: 'sm';
}

export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(({ size, role = 'group', className, children, ...props }, ref) => (
	<div ref={ref} role={role} data-size={size} className={className} {...props}>
		{children}
	</div>
));
ButtonGroup.displayName = 'ButtonGroup';
