import { Menu as BaseMenu } from '@base-ui/react/menu';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';
import clsx from 'clsx';
import type { ReactElement, ReactNode } from 'react';

const POSITIONER_Z_CLASSES = {
	menu: 'ui-menu-positioner',
	plain: 'ui-menu-positioner-plain',
} as const;

const SURFACE_CLASSES = {
	menu: 'ui-menu',
	plain: 'ui-menu-plain',
} as const;

const WIDTH_CLASSES = {
	content: '',
	anchor: 'ui-menu-anchor-width',
} as const;

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
}: MenuProps) => {
	const portalContainer = usePortalContainer();
	return (
		<BaseMenu.Root open={open} onOpenChange={onOpenChange} modal={modal}>
			<BaseMenu.Trigger render={triggerRender} {...triggerProps}>
				{trigger}
			</BaseMenu.Trigger>
			<BaseMenu.Portal container={container ?? portalContainer ?? undefined} keepMounted={keepMounted}>
				<BaseMenu.Positioner
					side={side}
					align={align}
					sideOffset={sideOffset}
					collisionPadding={collisionPadding}
					positionMethod={positionMethod}
					className={clsx(POSITIONER_Z_CLASSES[surface], positionerClassName)}
					{...positionerProps}>
					<BaseMenu.Popup
						render={<ul />}
						className={clsx('m-0 list-none p-0', SURFACE_CLASSES[surface], WIDTH_CLASSES[width], className)}
						{...popupProps}>
						{children}
					</BaseMenu.Popup>
				</BaseMenu.Positioner>
			</BaseMenu.Portal>
		</BaseMenu.Root>
	);
};
