import type { ReactNode } from 'react';

export type ToastVariant = 'info' | 'success' | 'error' | 'warning';

export interface ToastOptions {
	variant: ToastVariant;
	body: ReactNode;
	title?: string;
	/** `false` keeps the toast up until it is dismissed. */
	autohide?: boolean;
	/** Milliseconds before the toast auto-dismisses. Ignored when `autohide` is `false`. */
	delay?: number;
	canClose?: boolean;
	className?: string;
	/** Fires on dismissal, whether by the close button or the auto-dismiss timer. */
	onClose?: () => void;
}

/** Base UI's add options have no field for either, so they ride along as the toast's custom data. */
export interface ToastData {
	canClose: boolean;
	className?: string;
}
