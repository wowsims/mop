import { Menu as BaseMenu } from '@base-ui/react/menu';
import clsx from 'clsx';
import type { ReactElement, ReactNode } from 'react';

import { menuPositionerZClasses, menuSurfaceClasses, menuWidthClasses } from './classes';

export interface MenuProps {
	trigger: ReactNode;
	triggerRender?: ReactElement;
	triggerProps?: Record<string, unknown>;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	modal?: boolean;
	surface: 'menu' | 'plain';
	width?: 'content' | 'anchor';
	side?: BaseMenu.Positioner.Props['side'];
	align?: BaseMenu.Positioner.Props['align'];
	sideOffset?: BaseMenu.Positioner.Props['sideOffset'];
	collisionPadding?: BaseMenu.Positioner.Props['collisionPadding'];
	positionMethod?: BaseMenu.Positioner.Props['positionMethod'];
	container?: HTMLElement | null;
	keepMounted?: boolean;
	className?: string;
	positionerClassName?: string;
	positionerProps?: Record<string, unknown>;
	popupProps?: Record<string, unknown>;
	children: ReactNode;
}

export const Menu = ({
	trigger,
	triggerRender,
	triggerProps,
	open,
	onOpenChange,
	modal = false,
	surface,
	width = 'content',
	side,
	align,
	sideOffset,
	collisionPadding,
	positionMethod,
	container,
	keepMounted,
	className,
	positionerClassName,
	positionerProps,
	popupProps,
	children,
}: MenuProps) => (
	<BaseMenu.Root open={open} onOpenChange={onOpenChange} modal={modal}>
		<BaseMenu.Trigger render={triggerRender} {...triggerProps}>
			{trigger}
		</BaseMenu.Trigger>
		<BaseMenu.Portal container={container} keepMounted={keepMounted}>
			<BaseMenu.Positioner
				side={side}
				align={align}
				sideOffset={sideOffset}
				collisionPadding={collisionPadding}
				positionMethod={positionMethod}
				className={clsx(menuPositionerZClasses[surface], positionerClassName)}
				{...positionerProps}>
				<BaseMenu.Popup className={clsx(menuSurfaceClasses[surface], menuWidthClasses[width], className)} {...popupProps}>
					{children}
				</BaseMenu.Popup>
			</BaseMenu.Positioner>
		</BaseMenu.Portal>
	</BaseMenu.Root>
);
