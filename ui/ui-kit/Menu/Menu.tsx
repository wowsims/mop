import { Menu as BaseMenu } from '@base-ui/react/menu';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';
import clsx from 'clsx';
import type { ReactElement, ReactNode } from 'react';

const POSITIONER_Z_CLASSES = {
	menu: 'ui-menu-positioner',
	plain: 'ui-menu-positioner-plain',
	none: 'z-dropdown',
} as const;

const SURFACE_CLASSES = {
	menu: 'ui-menu',
	plain: 'ui-menu-plain',
	none: '',
} as const;

export interface MenuProps {
	trigger?: ReactNode;
	triggerRender?: ReactElement;
	triggerProps?: Record<string, unknown>;
	submenu?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	modal?: boolean;
	surface: 'menu' | 'plain' | 'none';
	anchorWidth?: boolean;
	side?: BaseMenu.Positioner.Props['side'];
	align?: BaseMenu.Positioner.Props['align'];
	sideOffset?: BaseMenu.Positioner.Props['sideOffset'];
	collisionPadding?: BaseMenu.Positioner.Props['collisionPadding'];
	positionMethod?: BaseMenu.Positioner.Props['positionMethod'];
	container?: HTMLElement | null;
	keepMounted?: boolean;
	className?: string;
	positionerClassName?: string;
	portalProps?: Record<string, unknown>;
	positionerProps?: Record<string, unknown>;
	popupRender?: ReactElement;
	popupProps?: Record<string, unknown>;
	children: ReactNode;
}

export const Menu = ({
	trigger,
	triggerRender,
	triggerProps,
	submenu,
	open,
	onOpenChange,
	modal = false,
	surface,
	anchorWidth,
	side,
	align,
	sideOffset,
	collisionPadding,
	positionMethod,
	container,
	keepMounted,
	className,
	positionerClassName,
	portalProps,
	positionerProps,
	popupRender,
	popupProps,
	children,
}: MenuProps) => {
	const portalContainer = usePortalContainer();
	const popup = (
		<BaseMenu.Portal container={container ?? portalContainer ?? undefined} keepMounted={keepMounted} {...portalProps}>
			<BaseMenu.Positioner
				side={side}
				align={align}
				sideOffset={sideOffset}
				collisionPadding={collisionPadding}
				positionMethod={positionMethod}
				className={clsx(POSITIONER_Z_CLASSES[surface], positionerClassName)}
				{...positionerProps}>
				<BaseMenu.Popup
					render={popupRender ?? <ul />}
					className={clsx('m-0 list-none p-0', SURFACE_CLASSES[surface], anchorWidth && 'ui-menu-anchor-width', className)}
					{...popupProps}>
					{children}
				</BaseMenu.Popup>
			</BaseMenu.Positioner>
		</BaseMenu.Portal>
	);

	// The row owns the popup: Base UI leaves focus guards where the portal sits, and they belong inside the `li`, not between the list's rows.
	if (submenu)
		return (
			<BaseMenu.SubmenuRoot>
				<li role="none">
					{trigger}
					{popup}
				</li>
			</BaseMenu.SubmenuRoot>
		);

	return (
		<BaseMenu.Root open={open} onOpenChange={onOpenChange} modal={modal}>
			<BaseMenu.Trigger render={triggerRender} {...triggerProps}>
				{trigger}
			</BaseMenu.Trigger>
			{popup}
		</BaseMenu.Root>
	);
};
