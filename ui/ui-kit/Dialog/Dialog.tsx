import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { Button } from '@ui-kit/Button';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import type { KeyboardEventHandler, ReactNode } from 'react';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

export interface DialogProps {
	open: boolean;
	/** Not called for a close the user is not allowed to make — see `preventClose`. */
	onOpenChange: (open: boolean) => void;
	className?: string;
	/** Base UI's default is `<body>`, and that is outside `.sim-ui` — which is where the spec theme lives. Measured on `warrior/arms`: inside `.sim-ui`, `--color-primary` is `rgb(199, 156, 110)` and a `.btn-primary` is brown on black; on `<body>` the same markup is Bootstrap's `rgb(13, 110, 253)` on white. */
	container?: HTMLElement | null;
	size?: DialogSize;
	maxWidth?: string;
	title?: ReactNode;
	/** Whether the header is a header bar. `false` keeps the close button but drops the padding and the bottom border. */
	header?: boolean;
	headerFlush?: boolean;
	/** Content beside the title, inside the header bar. */
	headerChildren?: ReactNode;
	footer?: ReactNode;
	/** Cap the popup at the viewport height and scroll the body, instead of scrolling the viewport. */
	scrollContents?: boolean;
	/** Removes the close button, the backdrop press and the Escape key. */
	preventClose?: boolean;
	/** Keep the dialog in the DOM while closed. */
	keepMounted?: boolean;
	/** For a dialog opened from another dialog. Without it both share one z-index tier, so this one's backdrop renders under the dialog that opened it instead of over it. */
	elevated?: boolean;
	verticalAlign?: 'top' | 'center';
	bodyGap?: string;
	bodyClassName?: string;
	closeClassName?: string;
	/** On the popup, which is where Base UI stops keydown propagation — a listener above it never sees a key. */
	onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
	children?: ReactNode;
	testId?: string;
}

export const Dialog = ({
	open,
	onOpenChange,
	className,
	container,
	size = 'lg',
	maxWidth,
	title,
	header = true,
	headerFlush = false,
	headerChildren,
	footer,
	scrollContents = false,
	preventClose = false,
	keepMounted = false,
	elevated = false,
	verticalAlign = 'top',
	bodyGap,
	bodyClassName,
	closeClassName,
	onKeyDown,
	children,
	testId,
}: DialogProps) => {
	const portalContainer = usePortalContainer();
	const headerBare = !header && title == null && headerChildren == null;
	return (
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
			<BaseDialog.Portal data-testid="sim-dialog-portal" container={container ?? portalContainer ?? undefined} keepMounted={keepMounted}>
				{/* Base UI renders no backdrop for a nested dialog (`enabled: forceRender || !nested`), so an elevated one has to ask for its own. */}
				<BaseDialog.Backdrop className="ui-dialog-backdrop" data-testid="sim-dialog-backdrop" data-elevated={elevated} forceRender={elevated} />
				<BaseDialog.Viewport className="ui-dialog-viewport" data-testid="sim-dialog-viewport" data-elevated={elevated}>
					<BaseDialog.Popup
						className={clsx(
							'ui-dialog',
							maxWidth,
							scrollContents && 'ui-dialog-scroll',
							verticalAlign === 'center' ? 'ui-dialog-centered' : 'ui-dialog-top',
							className,
						)}
						data-testid={testId ?? 'sim-dialog-popup'}
						data-size={size}
						onKeyDown={onKeyDown}>
						{(title != null || headerChildren != null || !preventClose) && (
							<div
								className={clsx('flex shrink-0 items-start', !headerBare && ['ui-dialog-header', headerFlush && 'ui-dialog-header-flush'])}
								data-testid="sim-dialog-header"
								data-bare={headerBare}>
								{title != null && (
									<BaseDialog.Title className="ui-dialog-title" data-testid="sim-dialog-title">
										{title}
									</BaseDialog.Title>
								)}
								{headerChildren}
								{!preventClose && (
									<BaseDialog.Close
										render={<Button iconOnly className={clsx('ui-dialog-close', closeClassName)} />}
										data-testid="sim-dialog-close"
										aria-label="Close">
										<Icon name="times" size="2xl" />
									</BaseDialog.Close>
								)}
							</div>
						)}
						<div className={clsx('ui-dialog-body', bodyGap, scrollContents && 'overflow-auto', bodyClassName)} data-testid="sim-dialog-body">
							{children}
						</div>
						{footer != null && (
							<div className="ui-dialog-footer" data-testid="sim-dialog-footer">
								{footer}
							</div>
						)}
					</BaseDialog.Popup>
				</BaseDialog.Viewport>
			</BaseDialog.Portal>
		</BaseDialog.Root>
	);
};
