import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { Button } from '@ui-kit/Button';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import type { KeyboardEventHandler, ReactNode } from 'react';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAX_WIDTH: Record<DialogSize, string> = {
	sm: 'max-w-modal-sm max-lg:max-w-[calc(100vw-2*var(--modal-margin))]',
	md: 'max-w-modal-md max-lg:max-w-[calc(100vw-2*var(--modal-margin))]',
	lg: 'max-w-modal-lg max-lg:max-w-[calc(100vw-2*var(--modal-margin))]',
	xl: 'max-w-modal-xl max-lg:max-w-[calc(100vw-2*var(--modal-margin))]',
};

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
				<BaseDialog.Backdrop
					className={clsx(
						'fixed inset-0 bg-black opacity-50 fade-in-out motion-reduce:transition-none',
						elevated ? 'z-modal-elevated-backdrop' : 'z-modal-backdrop',
					)}
					data-testid="sim-dialog-backdrop"
					data-elevated={elevated}
					forceRender={elevated}
				/>
				<BaseDialog.Viewport
					className={clsx(
						'fixed inset-0 overflow-x-hidden overflow-y-auto fade-in-out motion-reduce:transition-none',
						elevated ? 'z-modal-elevated' : 'z-modal',
					)}
					data-testid="sim-dialog-viewport"
					data-elevated={elevated}>
					<BaseDialog.Popup
						className={clsx(
							'sim-dialog-popup',
							'flex relative flex-col border border-surface-border bg-background bg-clip-padding outline-0 transition-transform duration-300 ease-out motion-reduce:transition-none',
							maxWidth ?? SIZE_MAX_WIDTH[size],
							scrollContents && 'max-h-[calc(100vh-2*var(--modal-margin))]',
							verticalAlign === 'center'
								? 'm-0 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
								: [
										'my-7 mx-auto',
										'data-[starting-style]:transform-(--modal-fade-transform) data-[ending-style]:transform-(--modal-fade-transform)',
									],
							className,
						)}
						data-testid={testId ?? 'sim-dialog-popup'}
						data-size={size}
						onKeyDown={onKeyDown}>
						{(title != null || headerChildren != null || !preventClose) && (
							<div
								className={clsx(
									'sim-dialog-header',
									'flex shrink-0 items-start',
									!headerBare && ['mx-5 border-b border-border', headerFlush ? 'pt-5 pb-0' : 'py-5'],
								)}
								data-testid="sim-dialog-header"
								data-bare={headerBare}>
								{title != null && (
									<BaseDialog.Title className="mb-0 text-lg leading-normal" data-testid="sim-dialog-title">
										{title}
									</BaseDialog.Title>
								)}
								{headerChildren}
								{!preventClose && (
									<BaseDialog.Close
										render={
											<Button
												iconOnly
												className={clsx(
													'flex items-center justify-center box-content w-[1em] h-[1em]',
													'-mt-2 -mb-2 -mr-1 ml-auto',
													'py-2 px-2',
													'text-link',
													'transition-colors duration-150 ease-in-out',
													'z-modal-close hover:text-white focus-visible:outline-0 focus-visible:shadow-focus-ring',
													closeClassName,
												)}
											/>
										}
										data-testid="sim-dialog-close"
										aria-label="Close">
										<Icon name="times" size="2xl" />
									</BaseDialog.Close>
								)}
							</div>
						)}
						<div
							className={clsx('flex relative flex-1 flex-col p-5', bodyGap ?? 'gap-5', scrollContents && 'overflow-auto', bodyClassName)}
							data-testid="sim-dialog-body">
							{children}
						</div>
						{footer != null && (
							<div className="flex shrink-0 flex-wrap items-center justify-end mx-5 py-5 border-t border-border" data-testid="sim-dialog-footer">
								{footer}
							</div>
						)}
					</BaseDialog.Popup>
				</BaseDialog.Viewport>
			</BaseDialog.Portal>
		</BaseDialog.Root>
	);
};
