import { Toast as BaseToast } from '@base-ui/react/toast';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';

import { DEFAULT_TOAST_DELAY, DEFAULT_TOAST_LIMIT, type ToastManager } from './manager';
import { ToastViewport } from './ToastViewport';

export interface ToastAreaProps {
	manager: ToastManager;
	/** Base UI's default is `<body>`, which is outside `.sim-ui` — a themed body (`.btn-outline-light`, item icons) needs the element that carries the spec theme. */
	container?: HTMLElement | null;
	/** Render in flow where the area is portaled, instead of pinned to the bottom right of the viewport. */
	inline?: boolean;
	className?: string;
	limit?: number;
	testId?: string;
}

export const ToastArea = ({ manager, container, inline = false, className, limit = DEFAULT_TOAST_LIMIT, testId }: ToastAreaProps) => {
	const portalContainer = usePortalContainer();
	return (
		<BaseToast.Provider toastManager={manager.base} timeout={DEFAULT_TOAST_DELAY} limit={limit}>
			{/* Named, because with a `container` the portal renders a wrapper element of its own. */}
			<BaseToast.Portal className="contents" data-testid="sim-toast-portal" container={container ?? portalContainer ?? undefined}>
				<ToastViewport inline={inline} className={className} testId={testId} />
			</BaseToast.Portal>
		</BaseToast.Provider>
	);
};
