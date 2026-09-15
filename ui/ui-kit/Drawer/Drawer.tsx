import { Drawer as BaseDrawer } from '@base-ui/react/drawer';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

export interface DrawerProps {
	trigger: ReactElement;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	ignoreOutsidePress?: (event: Event) => boolean;
	modal?: boolean;
	className?: string;
	/** Positions the portalled popup, since it no longer shares a containing block with its anchor. */
	style?: CSSProperties;
	children?: ReactNode;
	testId?: string;
}

export const Drawer = ({ trigger, open, onOpenChange, ignoreOutsidePress, modal = true, className, style, children, testId }: DrawerProps) => {
	const portalContainer = usePortalContainer();
	return (
		<BaseDrawer.Root
			open={open}
			modal={modal}
			onOpenChange={(nextOpen, eventDetails) => {
				if (!nextOpen && eventDetails.reason === 'outside-press' && ignoreOutsidePress?.(eventDetails.event)) {
					eventDetails.cancel();
					return;
				}
				onOpenChange?.(nextOpen);
			}}>
			<BaseDrawer.Trigger render={trigger} />
			<BaseDrawer.Portal container={portalContainer ?? undefined}>
				<BaseDrawer.Viewport className="contents">
					<BaseDrawer.Popup className={className} style={style} data-testid={testId ?? 'sim-drawer-popup'}>
						{children}
					</BaseDrawer.Popup>
				</BaseDrawer.Viewport>
			</BaseDrawer.Portal>
		</BaseDrawer.Root>
	);
};
