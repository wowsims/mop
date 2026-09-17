import { Toolbar as BaseToolbar } from '@base-ui/react/toolbar';
import clsx from 'clsx';
import type { ComponentPropsWithoutRef, Ref } from 'react';

export interface ToolbarProps extends Omit<ComponentPropsWithoutRef<'div'>, 'className'> {
	className?: string;
	orientation?: 'horizontal' | 'vertical';
	testId?: string;
	ref?: Ref<HTMLDivElement>;
}

export const Toolbar = ({ className, orientation = 'horizontal', testId, children, ...rest }: ToolbarProps) => (
	<BaseToolbar.Root orientation={orientation} className={clsx('ui-toolbar', className)} data-testid={testId} {...rest}>
		{children}
	</BaseToolbar.Root>
);
