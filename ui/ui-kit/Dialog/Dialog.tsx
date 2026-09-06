import './Dialog.scss';

import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

export interface DialogProps {
	open: boolean;
	/** Not called for a close the user is not allowed to make — see `preventClose`. */
	onOpenChange: (open: boolean) => void;
	cssClass?: string;
	/** Base UI's default is `<body>`, and that is outside `.sim-ui` — which is where the spec theme lives. Measured on `warrior/arms`: inside `.sim-ui`, `--bs-primary` is `rgb(199, 156, 110)` and a `.btn-primary` is brown on black; on `<body>` the same markup is Bootstrap's `rgb(13, 110, 253)` on white, and `--primary-dampened`, `--hover-color` and `--theme-component-text-color` do not resolve at all. */
	container?: HTMLElement | null;
	size?: DialogSize;
	title?: ReactNode;
	/** Whether the header is a header bar. `false` keeps the close button but drops the padding and the bottom border, which is what vanilla's `p-0 border-0` did. */
	header?: boolean;
	/** Content beside the title, inside the header bar. */
	headerChildren?: ReactNode;
	footer?: ReactNode;
	/** Cap the popup at the viewport height and scroll the body, instead of scrolling the viewport. */
	scrollContents?: boolean;
	/** Removes the close button, the backdrop press and the Escape key. */
	preventClose?: boolean;
	/** Keep the dialog in the DOM while closed, which is what `disposeOnClose: false` meant — and what eight of the ten vanilla callers got. */
	keepMounted?: boolean;
	children?: ReactNode;
}

export const Dialog = ({
	open,
	onOpenChange,
	cssClass,
	container,
	size = 'lg',
	title,
	header = true,
	headerChildren,
	footer,
	scrollContents = false,
	preventClose = false,
	keepMounted = false,
	children,
}: DialogProps) => (
	<BaseDialog.Root
		open={open}
		onOpenChange={(nextOpen, details) => {
			if (!nextOpen && preventClose) {
				details.cancel();
				return;
			}
			onOpenChange(nextOpen);
		}}>
		{/* Named, because with a `container` the portal renders a wrapper element of its own. */}
		<BaseDialog.Portal className="sim-dialog-portal" container={container} keepMounted={keepMounted}>
			<BaseDialog.Backdrop className="sim-dialog-backdrop" />
			<BaseDialog.Viewport className="sim-dialog-viewport">
				<BaseDialog.Popup className={clsx('sim-dialog-popup', `sim-dialog-popup--${size}`, scrollContents && 'sim-dialog-popup--scroll', cssClass)}>
					{(title != null || headerChildren != null || !preventClose) && (
						<div className={clsx('sim-dialog-header', !header && title == null && headerChildren == null && 'sim-dialog-header--bare')}>
							{title != null && <BaseDialog.Title className="sim-dialog-title">{title}</BaseDialog.Title>}
							{headerChildren}
							{!preventClose && (
								<BaseDialog.Close className="sim-dialog-close" aria-label="Close">
									<Icon name="times" size="2xl" />
								</BaseDialog.Close>
							)}
						</div>
					)}
					<div className="sim-dialog-body">{children}</div>
					{footer != null && <div className="sim-dialog-footer">{footer}</div>}
				</BaseDialog.Popup>
			</BaseDialog.Viewport>
		</BaseDialog.Portal>
	</BaseDialog.Root>
);
