import { Toast as BaseToast } from '@base-ui/react/toast';
import clsx from 'clsx';

import { Toast } from './Toast';
import type { ToastData } from './types';

export interface ToastViewportProps {
	className?: string;
}

export const ToastViewport = ({ className }: ToastViewportProps) => {
	const { toasts } = BaseToast.useToastManager<ToastData>();

	return (
		<BaseToast.Viewport className={clsx('sim-toast-viewport', className)}>
			{toasts.map(toast => (
				<Toast key={toast.id} toast={toast} />
			))}
		</BaseToast.Viewport>
	);
};
