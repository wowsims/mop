import { Input as BaseInput, type InputProps as BaseInputProps } from '@base-ui/react/input';
import clsx, { type ClassValue } from 'clsx';
import { forwardRef } from 'react';

import { INPUT_CLASSES } from './classes';

export interface InputProps extends Omit<BaseInputProps, 'className'> {
	className?: ClassValue;
}

export const Input = forwardRef<HTMLElement, InputProps>(({ className, ...props }, ref) => (
	<BaseInput ref={ref} className={clsx(INPUT_CLASSES, className)} {...props} />
));
Input.displayName = 'Input';
