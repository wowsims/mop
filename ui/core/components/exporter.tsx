import { ref } from 'tsx-vanilla';

import { SimUI } from '../sim_ui';
import { TypedEvent } from '../typed_event';
import { downloadString } from '../utils';
import { BaseModal } from './base_modal';
import { CopyButton } from './copy_button';
import i18n from '../../i18n/config';
import { trackPageView } from '../../tracking/utils';

export interface ExporterOptions {
	title: string;
	allowDownload?: boolean;
	header?: boolean;
}

export abstract class Exporter extends BaseModal {
	protected abstract readonly simUI: SimUI;
	private readonly textElem: Element;
	protected readonly changedEvent: TypedEvent<void> = new TypedEvent();

	constructor(parent: HTMLElement, options: ExporterOptions) {
		super(parent, 'exporter', { title: options.title, header: true, footer: true });

		this.textElem = <textarea spellcheck={false} className="exporter-textarea form-control" />;
		this.body.append(this.textElem);

		new CopyButton(this.footer!, {
			extraCssClasses: ['btn-primary'],
			getContent: () => this.textElem.innerHTML,
			text: i18n.t('export.json.copy_button'),
			tooltip: i18n.t('export.json.copy_tooltip'),
		});

		if (options.allowDownload) {
			const downloadBtnRef = ref<HTMLButtonElement>();
			this.footer!.appendChild(
				<button className="exporter-button btn btn-primary download-button ms-2" ref={downloadBtnRef}>
					<i className="fa fa-download me-1"></i>
					{i18n.t('export.json.download_button')}
				</button>,
			);

			const downloadButton = downloadBtnRef.value!;
			downloadButton.addEventListener('click', _event => {
				const data = this.textElem.textContent!;
				downloadString(data, 'wowsims.json');
			});
		}
	}

	open() {
		const titleAsSlug = this.header?.title.toLowerCase().replaceAll(' ', '-');
		trackPageView(this.header!.title, `/export/${titleAsSlug}`);
		super.open();
		this.init();
	}

	protected init() {
		this.changedEvent.on(() => this.updateContent());
		this.updateContent();
	}

	private updateContent() {
		this.textElem.textContent = this.getData();
	}

	abstract getData(): string;
}
