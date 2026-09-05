/** @jsxImportSource @jsx-vanilla */
import { kebabCase } from '@domain/format';
import { Emitter } from '@domain/state/events';
import type { SimHost } from '@features/sim_host';
import i18n from '@i18n/config';
import { BaseModal } from '@ui-kit/base_modal';
import { CopyButton } from '@ui-kit/copy_button';
import { downloadString } from '@ui-kit/dom_utils';
import { ref } from 'tsx-vanilla';

import { trackPageView } from '../../../tracking/analytics';

export interface ExporterOptions {
	title: string;
	allowDownload?: boolean;
	header?: boolean;
}

export abstract class Exporter extends BaseModal {
	protected abstract readonly simUI: SimHost;
	private readonly textElem: Element;
	// UI-local signal: export category checkboxes changed.
	protected readonly changeEmitter = new Emitter<void>();

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
		const titleAsSlug = this.header && kebabCase(this.header.title);
		trackPageView(this.header!.title, `/export/${titleAsSlug}`);
		super.open();
		this.init();
	}

	protected init() {
		this.changeEmitter.on(() => this.updateContent());
		this.updateContent();
	}

	private updateContent() {
		this.textElem.textContent = this.getData();
	}

	abstract getData(): string;
}
