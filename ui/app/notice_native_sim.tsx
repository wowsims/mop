import { LOCAL_STORAGE_PREFIX, REPO_RELEASES_URL } from '@domain/constants/other';
import { isDevMode } from '@domain/env';
import { Sim } from '@domain/sim';
import i18n from '@i18n/config';
import { Component } from '@ui-kit/component';
import Toast from '@ui-kit/toast';

export class NoticeNativeSim extends Component {
	container: HTMLElement;
	toast: Toast | null = null;
	constructor(parent: HTMLElement, sim: Sim) {
		super(null);
		this.container = parent;

		if (this.hasSeenNotice || sim.isNative || isDevMode()) return;

		this.render();

		this.toast?.element.addEventListener(
			'hide.bs.toast',
			() => {
				this.setHasSeenNotice();
			},
			{ once: true },
		);
	}

	private get settingsKey(): string {
		return `${LOCAL_STORAGE_PREFIX}_notice-local-sim.v1`;
	}

	private get hasSeenNotice() {
		return window.localStorage.getItem(this.settingsKey);
	}

	private setHasSeenNotice() {
		window.localStorage.setItem(this.settingsKey, 'true');
	}

	render() {
		this.toast = new Toast({
			additionalClasses: ['toast-notice-native-download'],
			container: this.container,
			variant: 'info',
			title: i18n.t('sim.notice_native_download.title'),
			autohide: false,
			body: (
				<div>
					<p>{i18n.t('sim.notice_native_download.message')}</p>
					<a href={REPO_RELEASES_URL} className="btn btn-outline-light" target="_blank" onclick={() => this.setHasSeenNotice()}>
						{i18n.t('sim.notice_native_download.download_button')}
					</a>
				</div>
			),
		});
	}
}
