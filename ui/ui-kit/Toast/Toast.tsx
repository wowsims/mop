import { Toast as BaseToast } from '@base-ui/react/toast';
import { Button } from '@ui-kit/Button';
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

const VARIANT_ICON_COLOR = {
	info: 'text-warning',
	warning: 'text-warning',
	success: 'text-success',
	error: 'text-danger',
} as const satisfies Record<ToastVariant, string>;

export interface ToastProps {
	toast: BaseToast.Root.ToastObject<ToastData>;
	inline?: boolean;
}

const TOAST_WIDTH = {
	inline: 'w-full max-w-full',
	floating: 'w-full max-w-full md:w-[350px]',
};

export const Toast = ({ toast, inline = false }: ToastProps) => {
	const variant = (toast.type ?? 'info') as ToastVariant;
	const canClose = toast.data?.canClose ?? true;

	return (
		<BaseToast.Root
			toast={toast}
			// An empty array is how Base UI spells "no swipe": `swipeEnabled` is `swipeDirections.length > 0`.
			swipeDirection={canClose ? undefined : []}
			className={clsx(
				inline ? TOAST_WIDTH.inline : TOAST_WIDTH.floating,
				'border border-surface-border rounded-none bg-overlay bg-clip-padding text-white text-sm shadow-toast fade-in-out pointer-events-auto data-[limited]:hidden motion-reduce:transition-none',
				toast.data?.className,
			)}
			data-testid="sim-toast"
			data-variant={variant}>
			<div className="flex items-center bg-overlay bg-clip-padding px-4 pt-4 pb-0 text-white">
				<Icon
					name={VARIANT_ICON[variant]}
					size="2xl"
					className={clsx('mr-2 block leading-none', VARIANT_ICON_COLOR[variant])}
					data-testid="sim-toast-icon"
				/>
				<BaseToast.Title className="m-0 mr-auto text-[length:inherit] leading-[inherit] font-bold" data-testid="sim-toast-title" />
				{/* `aria-hidden={false}`: Base UI hides the close button from assistive tech until the viewport is hovered or focused, because its own layout keeps toasts in a collapsed pile. This one is a flat column, so the button is on screen from the start. */}
				{canClose && (
					<BaseToast.Close
						render={
							<Button
								iconOnly
								className="flex items-center justify-center -mr-2 ml-4 p-[0.25em] text-white opacity-50 transition-[opacity] duration-150 ease-linear hover:opacity-100 focus-visible:outline-0 focus-visible:opacity-100 focus-visible:shadow-focus-ring"
							/>
						}
						data-testid="sim-toast-close"
						aria-label="Close"
						aria-hidden={false}>
						<Icon name="times" size="lg" />
					</BaseToast.Close>
				)}
			</div>
			{/* Base UI's `Description` is a `<p>`, and the bodies here are block content — a `<div>` inside a `<p>` gets reparented by a real parser. */}
			<BaseToast.Description render={<div />} className="p-4 wrap-break-word" data-testid="sim-toast-body" />
		</BaseToast.Root>
	);
};
