import { Menu as BaseMenu } from '@base-ui/react/menu';
import clsx from 'clsx';
import type { ReactElement, ReactNode } from 'react';

const LAYOUT_CLASSES = {
	block: '',
	row: 'ui-menu-item-row',
} as const;

export interface MenuItemProps {
	layout: 'block' | 'row';
	/** Opens the submenu `Menu` this item is the `trigger` of, rather than acting on click. That `Menu` supplies the row's `li`. */
	submenu?: boolean;
	disabled?: boolean;
	onClick?: () => void;
	render?: ReactElement;
	className?: string;
	children: ReactNode;
	[key: string]: unknown;
}

export const MenuItem = ({ layout, submenu, disabled, onClick, render, className, children, ...rest }: MenuItemProps) => {
	const itemProps = {
		render: render ?? <button type="button" />,
		disabled,
		onClick,
		className: clsx('ui-menu-item', LAYOUT_CLASSES[layout], className),
		...rest,
	};
	if (submenu) return <BaseMenu.SubmenuTrigger {...itemProps}>{children}</BaseMenu.SubmenuTrigger>;
	return (
		<li role="none">
			<BaseMenu.Item {...itemProps}>{children}</BaseMenu.Item>
		</li>
	);
};
