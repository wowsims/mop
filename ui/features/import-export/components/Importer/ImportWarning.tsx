import i18n from '@i18n/config';
import Toast from '@ui-kit/toast';
import { useCallback } from 'react';

export interface ImportWarningProps {
	titleKey: string;
	messageKey: string;
}

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
				// animation: false, or Bootstrap's deferred show() callback reads _element after dispose() nulled it (StrictMode remount).
				animation: false,
			});
			return () => toast.destroy();
		},
		[titleKey, messageKey],
	);

	return <div ref={mount} />;
};
