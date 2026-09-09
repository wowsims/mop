import i18n from '@i18n/config';
import { LOCAL_STORAGE_PREFIX, REPO_RELEASES_URL } from '@sim/constants/other';
import { useSim } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { isDevMode } from '@sim/utils/env';
import { createToastManager, ToastArea } from '@ui-kit/Toast';
import { useEffect, useMemo, useState } from 'react';

export interface NoticeNativeSimProps {
	container: HTMLElement;
}

const SETTINGS_KEY = `${LOCAL_STORAGE_PREFIX}_notice-local-sim.v1`;

const setHasSeenNotice = () => window.localStorage.setItem(SETTINGS_KEY, 'true');

export const NoticeNativeSim = ({ container }: NoticeNativeSimProps) => {
	const sim = useSim();
	// `sim.isNative` is decided during init, so this cannot be asked any earlier.
	const ready = useSimReady();
	const manager = useMemo(() => createToastManager(), []);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (!ready || sim.isNative || isDevMode() || window.localStorage.getItem(SETTINGS_KEY)) return;
		setVisible(true);
	}, [ready, sim]);

	// Split from the gate above so the area is already mounted and subscribed when the toast is added — one added earlier is dropped.
	useEffect(() => {
		if (!visible) return;
		manager.add({
			variant: 'info',
			title: i18n.t('sim.notice_native_download.title'),
			autohide: false,
			onClose: setHasSeenNotice,
			body: (
				<div>
					<p>{i18n.t('sim.notice_native_download.message')}</p>
					<a href={REPO_RELEASES_URL} className="btn btn-outline-light" target="_blank" onClick={setHasSeenNotice}>
						{i18n.t('sim.notice_native_download.download_button')}
					</a>
				</div>
			),
		});
		return () => manager.close();
	}, [manager, visible]);

	if (!visible) return null;

	return <ToastArea manager={manager} container={container} inline className="toast-notice-native-download" />;
};
