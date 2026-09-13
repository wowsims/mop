import { Toast as BaseToast } from '@base-ui/react/toast';
import clsx from 'clsx';

import { Toast } from './Toast';
import type { ToastData } from './types';

export interface ToastViewportProps {
	inline?: boolean;
	className?: string;
}

export const ToastViewport = ({ inline = false, className }: ToastViewportProps) => {
	const { toasts } = BaseToast.useToastManager<ToastData>();

	return (
		<BaseToast.Viewport
			className={clsx(inline ? 'ui-toast-viewport-inline' : 'ui-toast-viewport', className)}
			data-testid="sim-toast-viewport"
			data-inline={inline}>
			{toasts.map(toast => (
				<Toast key={toast.id} toast={toast} inline={inline} />
			))}
		</BaseToast.Viewport>
	);
};
