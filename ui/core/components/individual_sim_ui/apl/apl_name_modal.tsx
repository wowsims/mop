import { ref } from 'tsx-vanilla';

import i18n from '../../../../i18n/config';
import { BaseModal } from '../../base_modal';

type APLNameModalConfig = {
	title: string;
	inputLabel: string;
	confirmButtonLabel?: string;
	inputPlaceholder?: string;
	defaultValue?: string;
	existingNames: string[] | (() => string[]);
	onSubmit: (name: string) => void;
	onCancel?: () => void;
};

export class APLNameModal extends BaseModal {
	constructor(parent: HTMLElement, config: APLNameModalConfig) {
		super(parent, 'apl-name-modal', { disposeOnClose: true, footer: true, size: 'sm', title: config.title });

		const inputRef = ref<HTMLInputElement>();
		const errorRef = ref<HTMLDivElement>();
		const createButtonRef = ref<HTMLButtonElement>();

		this.body.appendChild(
			<div className="apl-name-modal-body">
				<label className="form-label">{config.inputLabel}</label>
				<input
					type="text"
					className="form-control"
					ref={inputRef}
					placeholder={config.inputPlaceholder || ''}
				/>
				<div className="invalid-feedback" ref={errorRef} />
			</div>,
		);

		const createButton = (
			<button type="button" className="btn btn-primary" disabled ref={createButtonRef}>
				{config.confirmButtonLabel || i18n.t('rotation_tab.apl.nameModal.create')}
			</button>
		) as HTMLButtonElement;

		this.footer!.appendChild(createButton);

		const input = inputRef.value!;
		const errorDiv = errorRef.value!;

		if (config.defaultValue) {
			input.value = config.defaultValue;
		}

		const getExistingNames = () =>
			typeof config.existingNames === 'function' ? config.existingNames() : config.existingNames;

		const validate = () => {
			const name = input.value.trim();
			if (!name) {
				input.classList.remove('is-invalid');
				errorDiv.textContent = '';
				createButton.disabled = true;
				return;
			}

			const conflict = getExistingNames().some(n => n === name);
			if (conflict) {
				input.classList.add('is-invalid');
				errorDiv.textContent = i18n.t('rotation_tab.apl.nameModal.nameConflict');
				createButton.disabled = true;
				return;
			}

			input.classList.remove('is-invalid');
			errorDiv.textContent = '';
			createButton.disabled = false;
		};

		input.addEventListener('input', validate);
		validate();

		let submitted = false;
		const submit = () => {
			const name = input.value.trim();
			if (!name) return;
			if (getExistingNames().some(n => n === name)) return;
			submitted = true;
			config.onSubmit(name);
			this.close();
		};

		createButton.addEventListener('click', submit);
		input.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !createButton.disabled) {
				submit();
			}
		});

		if (config.onCancel) {
			this.addOnHideCallback(() => {
				if (!submitted) config.onCancel!();
			});
		}

		this.open();

		// Focus the input after the modal is shown
		this.rootElem.addEventListener('shown.bs.modal', () => input.focus(), { once: true });
	}
}
