import type { SimHost } from '@features/sim_host';
import i18n from '@i18n/config';
import { BaseModal } from '@ui-kit/base_modal';
import Toast from '@ui-kit/toast';
import { ref } from 'tsx-vanilla';

import { trackPageView } from '../../../tracking/analytics';

export interface ImporterOptions {
	title: string;
	allowFileUpload?: boolean;
}

export abstract class Importer extends BaseModal {
	protected abstract readonly simUI: SimHost;

	protected readonly textElem: HTMLTextAreaElement;
	protected readonly descriptionElem: HTMLElement;
	protected readonly importButton: HTMLButtonElement;
	private readonly allowFileUpload: boolean;

	constructor(parent: HTMLElement, options: ImporterOptions) {
		super(parent, 'importer', { title: options.title, footer: true, disposeOnClose: false });
		this.allowFileUpload = options.allowFileUpload || false;
		const uploadInputId = 'upload-input-' + options.title.toLowerCase().replaceAll(' ', '-');

		const descriptionElemRef = ref<HTMLDivElement>();
		const textElemRef = ref<HTMLTextAreaElement>();
		const importButtonRef = ref<HTMLButtonElement>();
		const uploadInputRef = ref<HTMLInputElement>();

		this.body.replaceChildren(
			<div>
				<div ref={descriptionElemRef} className="import-description"></div>
				<textarea ref={textElemRef} className="importer-textarea form-control" attributes={{ spellcheck: false }}></textarea>
			</div>,
		);

		this.footer!.appendChild(
			<div className="d-flex gap-2">
				{this.allowFileUpload && (
					<label htmlFor={uploadInputId} className="importer-button btn btn-primary upload-button">
						<i className="fas fa-file-arrow-up me-1"></i>
						{i18n.t('import.json.upload_button')}
					</label>
				)}
				<input ref={uploadInputRef} type="file" id={uploadInputId} className="importer-upload-input d-none" hidden />
				<button ref={importButtonRef} className="importer-button btn btn-primary import-button">
					<i className="fa fa-download me-1"></i>
					{i18n.t('import.json.import_button')}
				</button>
			</div>,
		);

		this.descriptionElem = descriptionElemRef.value!;
		this.textElem = textElemRef.value!;

		if (this.allowFileUpload && uploadInputRef.value) {
			uploadInputRef.value.addEventListener('change', async event => {
				this.textElem.textContent = await (event as any).target.files[0].text();
			});
		}

		this.importButton = importButtonRef.value!;
		this.importButton.addEventListener('click', async _event => {
			try {
				await this.onImport(this.textElem.value || '');
			} catch (error: any) {
				new Toast({ variant: 'error', body: `Import error: ${error?.message || error}` });
			}
		});
	}

	open() {
		const titleAsSlug = this.header?.title.toLowerCase().replaceAll(' ', '-');
		trackPageView(this.header!.title, `/import/${titleAsSlug}`);
		super.open();
	}

	abstract onImport(data: string): Promise<void>;
}

// The standing warning an importer pins above its input: same styling, always
// visible, never dismissable. Only the strings differ between importers.
export function showImportWarning(container: HTMLElement, titleKey: string, messageKey: string) {
	new Toast({
		title: i18n.t(titleKey),
		body: <div>{i18n.t(messageKey)}</div>,
		additionalClasses: ['toast-import-warning'],
		container,
		variant: 'warning',
		canClose: false,
		autoShow: true,
		autohide: false,
	});
}
