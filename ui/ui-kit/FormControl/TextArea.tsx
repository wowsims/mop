import clsx, { type ClassValue } from 'clsx';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';

import { INPUT_CLASSES } from './classes';

export interface TextAreaProps extends Omit<ComponentPropsWithoutRef<'textarea'>, 'className'> {
	className?: ClassValue;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({ className, ...props }, ref) => (
	<textarea ref={ref} className={clsx(INPUT_CLASSES, className)} {...props} />
));
TextArea.displayName = 'TextArea';
