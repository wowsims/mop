// The modal surface, on Base UI's `Dialog` instead of Bootstrap's `Modal` plugin.
//
// It parameterises what `BaseModal`'s config parameterises — `size`, `title`, whether there is a
// footer, whether the user may close it — and fixes what `BaseModal` fixes: the header/body/footer
// stack and the close button in the top right. Header contents beyond the title are the one axis
// two vanilla callers use and this does not carry yet (`AdvancedEncounterModal` puts a picker in
// the header, `SelectorModal`'s stylesheet has an `& + .btn-close` sibling rule); widen it with a
// `headerChildren` prop when the first of them ports, rather than letting either fork the markup.
//
// Structure, against `ui-kit/base_modal.tsx`:
//
//   Backdrop   .modal-backdrop  — portaled with the popup, so `showBSFn`'s "wait 100ms, then move
//              the backdrop out of <body> and next to my modal" hack has nothing left to do
//   Viewport   .modal           — the fixed, scrollable full-screen layer
//   Popup      .modal-dialog + .modal-content, merged: one element cannot be both the box that is
//              capped at the viewport height and the box that paints the border, and vanilla's
//              split leaves tall content spilling out below a border drawn at 671px (measured).
//              So `scrollContents` decides which one scrolls: the popup, or the viewport.
//
// The class names are ours. Reusing `.modal-*` would be worse than useless here: those rules read
// `--bs-modal-*`, which Bootstrap emits inside `.modal` and nowhere else, so a portaled popup
// wearing `.modal-body` would get `padding: <empty>` rather than 1.25rem. The `--modal-*` tokens in
// `shared/_variables.scss` are the seam instead.
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
	/**
	 * `BaseModal`'s second constructor argument. It lands on the popup, which is the merge of the
	 * `.modal-dialog` it used to land on and the `.modal-content` inside it.
	 */
	cssClass?: string;
	/**
	 * Where the popup is portaled. Base UI's default is `<body>`, and that is outside `.sim-ui` —
	 * which is where the spec theme lives. Measured on `warrior/arms`: inside `.sim-ui`,
	 * `--bs-primary` is `rgb(199, 156, 110)` and a `.btn-primary` is brown on black; on `<body>` the
	 * same markup is Bootstrap's `rgb(13, 110, 253)` on white, and `--bs-primary-dampened`,
	 * `--bs-hover-color` and `--theme-component-text-color` do not resolve at all. Every vanilla
	 * modal is a child of `simUI.rootElem` for exactly this reason, so any dialog whose contents use
	 * `.btn-primary` or a `--bs-primary*` has to pass it. The chrome here does not — it reads only
	 * tokens that resolve at `:root`.
	 */
	container?: HTMLElement | null;
	size?: DialogSize;
	title?: ReactNode;
	/**
	 * Whether the header is a header bar. `false` keeps the close button but drops the padding and
	 * the bottom border, which is what vanilla's `p-0 border-0` did. No caller passes it today.
	 */
	header?: boolean;
	/**
	 * Content beside the title, inside the header bar. `AdvancedEncounterModal` puts a preset picker
	 * there with `order-first`, and `SelectorModal`'s stylesheet has an `& + .btn-close` sibling rule
	 * that depends on something sitting between the title and the close button.
	 */
	headerChildren?: ReactNode;
	/** The footer's contents. Vanilla rendered an empty `.modal-footer` for callers to append into. */
	footer?: ReactNode;
	/** Cap the popup at the viewport height and scroll the body, instead of scrolling the viewport. */
	scrollContents?: boolean;
	/** Removes the close button, the backdrop press and the Escape key. Programmatic close still works. */
	preventClose?: boolean;
	/**
	 * Keep the dialog in the DOM while closed, which is what `disposeOnClose: false` meant — and what
	 * eight of the ten vanilla callers got. It also keeps the modal in the set `parity.mjs` compares,
	 * which is otherwise a diff on every spec.
	 */
	keepMounted?: boolean;
	/** The body's contents. */
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
			// `preventClose` was `backdrop: 'static'` + `keyboard: false` + no close button. Cancelling
			// covers all three reasons at once, and leaves a programmatic `open={false}` alone — which
			// is how both of its users (`ProgressTrackerModal`, the combustion calculator) close.
			if (!nextOpen && preventClose) {
				details.cancel();
				return;
			}
			onOpenChange(nextOpen);
		}}>
		{/* Named, because with a `container` the portal renders a wrapper element of its own. Unnamed
		    it is a classless `<div>` among the sim root's children, which no gate can pick out from
		    anything else — `parity.mjs` treats this one class as the whole dialog. */}
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
