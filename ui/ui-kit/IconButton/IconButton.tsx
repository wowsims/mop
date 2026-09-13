import clsx, { type ClassValue } from 'clsx';
import { type ButtonHTMLAttributes, cloneElement, forwardRef, type ReactElement } from 'react';

export type IconButtonTone = 'inherit' | 'link' | 'danger' | 'warning';

const TONE: Record<IconButtonTone, string> = {
	inherit: '',
	link: 'text-link',
	danger: 'text-link-danger',
	warning: 'text-link-warning',
};

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
	label: string;
	tone?: IconButtonTone;
	className?: ClassValue;
	render?: ReactElement<{ className?: string }>;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(({ label, tone = 'inherit', className, render, children, ...props }, ref) => {
	const classes = clsx('border-0 bg-transparent cursor-pointer', TONE[tone], className);

	if (render) {
		return cloneElement(render, { ...props, ref, 'aria-label': label, className: clsx(classes, render.props.className) } as never);
	}

	return (
		<button type="button" ref={ref} aria-label={label} className={classes} {...props}>
			{children}
		</button>
	);
});
IconButton.displayName = 'IconButton';
