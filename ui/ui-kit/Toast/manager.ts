import { Toast as BaseToast } from '@base-ui/react/toast';

import type { ToastData, ToastOptions } from './types';

export const DEFAULT_TOAST_DELAY = 3000;

/** Beyond this the oldest toasts are flagged `data-limited`, which `Toast.scss` hides. */
export const DEFAULT_TOAST_LIMIT = 5;

const createBaseToastManager = () => BaseToast.createToastManager<ToastData>();

export type BaseToastManager = ReturnType<typeof createBaseToastManager>;

export interface ToastManager {
	add: (options: ToastOptions) => string;
	/** With no id this closes every toast in the area and clears its timers, not just the last one. */
	close: (id?: string) => void;
	/** What `<ToastArea>` hands to `Toast.Provider`. Going through it directly skips the option mapping. */
	base: BaseToastManager;
}

export const createToastManager = (): ToastManager => {
	const base = createBaseToastManager();
	return {
		base,
		add: ({ variant, body, title = 'WowSims', autohide = true, delay = DEFAULT_TOAST_DELAY, canClose = true, className }: ToastOptions) =>
			base.add({
				title,
				description: body,
				type: variant,
				timeout: autohide ? delay : 0,
				data: { canClose, className },
			}),
		close: (id?: string) => base.close(id),
	};
};

/** The standard bottom-right area. A toast added before its `<ToastArea>` mounts is dropped. */
export const toastManager = createToastManager();
