import { Menu as BaseMenu } from '@base-ui/react/menu';
import clsx from 'clsx';
import type { ReactElement, ReactNode } from 'react';

import { menuItemBaseClasses, menuItemLayoutClasses } from './classes';

export interface MenuItemProps {
	layout: 'block' | 'row';
	disabled?: boolean;
	onClick?: () => void;
	render?: ReactElement;
	className?: string;
	children: ReactNode;
	[key: string]: unknown;
}

export const MenuItem = ({ layout, disabled, onClick, render, className, children, ...rest }: MenuItemProps) => (
	<BaseMenu.Item
		render={render}
		disabled={disabled}
		onClick={onClick}
		className={clsx(menuItemBaseClasses, menuItemLayoutClasses[layout], className)}
		{...rest}>
		{children}
	</BaseMenu.Item>
);
