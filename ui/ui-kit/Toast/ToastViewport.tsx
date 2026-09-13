import { Toast as BaseToast } from '@base-ui/react/toast';
import clsx from 'clsx';

import { Toast } from './Toast';
import type { ToastData } from './types';

export interface ToastViewportProps {
	inline?: boolean;
	className?: string;
}

const VIEWPORT_CLASS = 'flex fixed right-0 bottom-0 z-(--z-toast) flex-col items-end gap-2 w-full max-w-full p-4 pointer-events-none';
const VIEWPORT_CLASS_INLINE = 'flex static right-0 bottom-0 z-auto flex-col items-stretch gap-2 w-full max-w-full p-0 pointer-events-none';

export const ToastViewport = ({ inline = false, className }: ToastViewportProps) => {
	const { toasts } = BaseToast.useToastManager<ToastData>();

	return (
		<BaseToast.Viewport
			className={clsx('sim-toast-viewport', inline && 'sim-toast-viewport--inline', inline ? VIEWPORT_CLASS_INLINE : VIEWPORT_CLASS, className)}
			data-testid="sim-toast-viewport">
			{toasts.map(toast => (
				<Toast key={toast.id} toast={toast} inline={inline} />
			))}
		</BaseToast.Viewport>
	);
};
