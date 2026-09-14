import { Input as BaseInput, type InputProps as BaseInputProps } from '@base-ui/react/input';
import clsx, { type ClassValue } from 'clsx';
import { forwardRef } from 'react';

export interface InputProps extends Omit<BaseInputProps, 'className'> {
	className?: ClassValue;
}

export const Input = forwardRef<HTMLElement, InputProps>(({ className, ...props }, ref) => (
	<BaseInput ref={ref} className={clsx('ui-input', className)} {...props} />
));
Input.displayName = 'Input';
