import i18n from '@i18n/config';
import Toast from '@ui-kit/toast';
import { useCallback } from 'react';

export interface ImportWarningProps {
	titleKey: string;
	messageKey: string;
}

/**
 * The standing warning two importers pin above their input: same styling, always visible, never
 * dismissable. Only the strings differ, which is why `showImportWarning` was one function and this
 * is one component.
 *
 * `Toast` is a vanilla Bootstrap widget and stays one — Base UI's `Toast` is the deferred Phase 2
 * item and would need every one of its eleven other call sites. It is also not a `Component`
 * (`element`/`destroy`, not `rootElem`/`dispose`), so `useLegacyMount` cannot host it; this is the
 * same ref-callback-with-cleanup shape written out by hand. The body is a real `<div>` because
 * `ToastOptions.body` takes `string | Element` and the vanilla caller passed a `<div>`.
 */
export const ImportWarning = ({ titleKey, messageKey }: ImportWarningProps) => {
	const mount = useCallback(
		(container: HTMLElement | null) => {
			if (!container) return;
			const body = document.createElement('div');
			body.textContent = i18n.t(messageKey);
			const toast = new Toast({
				title: i18n.t(titleKey),
				body,
				additionalClasses: ['toast-import-warning'],
				container,
				variant: 'warning',
				canClose: false,
				autoShow: true,
				autohide: false,
				// The one option vanilla did not pass, and it is what makes the cleanup safe.
				// Bootstrap's `show()` queues its "done showing" callback behind `transitionend` plus a
				// timeout even when nothing transitions, and that callback reads `this._element` — which
				// `dispose()` nulls. StrictMode's mount/cleanup/mount then throws
				// `Cannot read properties of null (reading 'classList')`, caught by `mount-once.mjs`.
				// `animation: false` makes Bootstrap run the callback synchronously instead, so there is
				// nothing pending to dispose underneath. Nothing is lost: this toast is created while its
				// dialog is closed, so its fade-in was never on screen.
				animation: false,
			});
			return () => toast.destroy();
		},
		[titleKey, messageKey],
	);

	return <div ref={mount} />;
};
