import i18n from '@i18n/config';
import { createToastManager, ToastArea } from '@ui-kit/Toast';
import { useEffect, useMemo, useState } from 'react';

export interface ImportWarningProps {
	titleKey: string;
	messageKey: string;
}

export const ImportWarning = ({ titleKey, messageKey }: ImportWarningProps) => {
	const manager = useMemo(() => createToastManager(), []);
	const [host, setHost] = useState<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!host) return;
		manager.add({ variant: 'warning', title: i18n.t(titleKey), body: i18n.t(messageKey), canClose: false, autohide: false });
		return () => manager.close();
	}, [host, manager, titleKey, messageKey]);

	return (
		<div ref={setHost}>
			<ToastArea manager={manager} container={host} inline />
		</div>
	);
};
