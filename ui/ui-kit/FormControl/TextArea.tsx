import clsx, { type ClassValue } from 'clsx';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';

export interface TextAreaProps extends Omit<ComponentPropsWithoutRef<'textarea'>, 'className'> {
	className?: ClassValue;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({ className, ...props }, ref) => (
	<textarea ref={ref} className={clsx('ui-input', className)} {...props} />
));
TextArea.displayName = 'TextArea';
