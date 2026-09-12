import i18n from '@i18n/config';
import { LOCAL_STORAGE_PREFIX, REPO_RELEASES_URL } from '@sim/constants/other';
import { useSim } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { isDevMode } from '@sim/utils/env';
import { useTypedLocalStorage } from '@ui-kit/hooks/useTypedLocalStorage';
import { createToastManager, ToastArea } from '@ui-kit/Toast';
import { useEffect, useMemo, useState } from 'react';

export interface NoticeNativeSimProps {
	container: HTMLElement;
}

const SETTINGS_KEY = `${LOCAL_STORAGE_PREFIX}_notice-local-sim.v1`;

// The flag has always been written as the bare string `true`, which is also its JSON form, so it
// reads back unchanged through the shared hook.
const parseSeen = (value: unknown): boolean | undefined => (value === true ? true : undefined);

export const NoticeNativeSim = ({ container }: NoticeNativeSimProps) => {
	const sim = useSim();
	// `sim.isNative` is decided during init, so this cannot be asked any earlier.
	const ready = useSimReady();
	const manager = useMemo(() => createToastManager(), []);
	const [visible, setVisible] = useState(false);
	const [hasSeenNotice, setHasSeen] = useTypedLocalStorage<boolean>(SETTINGS_KEY, parseSeen);

	useEffect(() => {
		if (!ready || sim.isNative || isDevMode() || hasSeenNotice) return;
		setVisible(true);
	}, [ready, sim, hasSeenNotice]);

	// Split from the gate above so the area is already mounted and subscribed when the toast is added — one added earlier is dropped.
	useEffect(() => {
		if (!visible) return;
		manager.add({
			variant: 'info',
			title: i18n.t('sim.notice_native_download.title'),
			autohide: false,
			onClose: () => setHasSeen(true),
			body: (
				<div>
					<p>{i18n.t('sim.notice_native_download.message')}</p>
					<a href={REPO_RELEASES_URL} className="btn btn-outline-light" target="_blank" onClick={() => setHasSeen(true)}>
						{i18n.t('sim.notice_native_download.download_button')}
					</a>
				</div>
			),
		});
		return () => manager.close();
	}, [manager, visible, setHasSeen]);

	if (!visible) return null;

	return <ToastArea manager={manager} container={container} inline className="toast-notice-native-download" />;
};
