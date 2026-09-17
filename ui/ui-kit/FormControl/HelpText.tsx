import clsx, { type ClassValue } from 'clsx';
import { type ElementType, type ReactNode } from 'react';

export interface HelpTextProps {
	as?: 'div' | 'p' | 'span';
	hidden?: boolean;
	className?: ClassValue;
	children?: ReactNode;
}

export const HelpText = ({ as = 'div', hidden, className, children }: HelpTextProps) => {
	const Tag = as as ElementType;
	return (
		<Tag hidden={hidden} className={clsx('ui-help-text', className)}>
			{children}
		</Tag>
	);
};
