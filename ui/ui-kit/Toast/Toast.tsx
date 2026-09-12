import { Toast as BaseToast } from '@base-ui/react/toast';
import { Icon } from '@ui-kit/Icon';
import type { IconName } from '@ui-kit/Icon/types';
import clsx from 'clsx';

import type { ToastData, ToastVariant } from './types';

const VARIANT_ICON = {
	info: 'info-circle',
	success: 'check-circle',
	error: 'circle-exclamation',
	warning: 'triangle-exclamation',
} as const satisfies Record<ToastVariant, IconName>;

export interface ToastProps {
	toast: BaseToast.Root.ToastObject<ToastData>;
}

export const Toast = ({ toast }: ToastProps) => {
	const variant = (toast.type ?? 'info') as ToastVariant;
	const canClose = toast.data?.canClose ?? true;

	return (
		<BaseToast.Root
			toast={toast}
			// An empty array is how Base UI spells "no swipe": `swipeEnabled` is `swipeDirections.length > 0`.
			swipeDirection={canClose ? undefined : []}
			className={clsx('sim-toast', `sim-toast--${variant}`, toast.data?.className)}>
			<div className="sim-toast-header">
				<Icon name={VARIANT_ICON[variant]} size="2xl" className="sim-toast-icon" />
				<BaseToast.Title className="sim-toast-title" />
				{/* `aria-hidden={false}`: Base UI hides the close button from assistive tech until the viewport is hovered or focused, because its own layout keeps toasts in a collapsed pile. This one is a flat column, so the button is on screen from the start. */}
				{canClose && (
					<BaseToast.Close className="sim-toast-close" aria-label="Close" aria-hidden={false}>
						<Icon name="times" size="lg" />
					</BaseToast.Close>
				)}
			</div>
			{/* Base UI's `Description` is a `<p>`, and the bodies here are block content — a `<div>` inside a `<p>` gets reparented by a real parser. */}
			<BaseToast.Description render={<div />} className="sim-toast-body" />
		</BaseToast.Root>
	);
};
