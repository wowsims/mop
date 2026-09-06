/** @jsxImportSource @jsx-vanilla */
import type { StoreSubscribe } from '@domain/state/subscriptions';
import i18n from '@i18n/config';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { trackEvent } from '../tracking/analytics';
import { Component } from './component';
import { ContentBlock, ContentBlockHeaderConfig } from './content_block';
export type SavedDataManagerConfig<ModObject, T> = {
	label: string;
	header?: ContentBlockHeaderConfig;
	extraCssClasses?: string[];
	presetsOnly?: boolean;
	loadOnly?: boolean;
	storageKey: string;
	// Store subscription that fires when the managed data may have changed.
	subscribe: StoreSubscribe;
	// Optional semantic equality (e.g. rotations, where the type/uuids may differ);
	// without it entries compare by their `toJson` string.
	equals?: (a: T, b: T) => boolean;
	getData: (modObject: ModObject) => T;
	setData: (modObject: ModObject, data: T) => void;
	toJson: (a: T) => any;
	fromJson: (obj: any) => T;
	nameLabel?: string;
	saveButtonText?: string;
	deleteTooltip?: string;
	deleteConfirmMessage?: string;
	chooseNameAlert?: string;
	nameExistsAlert?: string;
};

export type SavedDataConfig<ModObject, T> = {
	name: string;
	data: T;
	tooltip?: string;
	isPreset?: boolean;
	// If set, will automatically hide the saved data when this evaluates to false.
	enableWhen?: (obj: ModObject) => boolean;
	// Will execute when the saved data is loaded.
	onLoad?: (obj: ModObject) => void;
};

type SavedData<ModObject, T> = {
	name: string;
	data: T;
	// Serialized form of `data` (only when the manager has no semantic `equals`),
	// compared against the current value by string so an active-check costs one
	// serialization per manager, not one deep proto equals per entry.
	dataJson?: string;
	elem: HTMLElement;
} & Pick<SavedDataConfig<ModObject, T>, 'enableWhen' | 'onLoad'>;

export class SavedDataManager<ModObject, T> extends Component {
	private readonly modObject: ModObject;
	private readonly config: SavedDataManagerConfig<ModObject, T>;

	private readonly userData: Array<SavedData<ModObject, T>>;
	private readonly presets: Array<SavedData<ModObject, T>>;

	private readonly savedDataDiv: HTMLElement;
	private readonly presetDataDiv: HTMLElement;
	private readonly customDataDiv: HTMLElement;
	private saveInput?: HTMLInputElement;

	private frozen: boolean;
	private pendingCheckFrame: number | null = null;

	constructor(parent: HTMLElement | null, modObject: ModObject, config: SavedDataManagerConfig<ModObject, T>) {
		super(parent, 'saved-data-manager-root');
		this.modObject = modObject;
		this.config = config;

		this.userData = [];
		this.presets = [];
		this.frozen = false;

		// One coalesced active-check per manager per change burst, deferred to
		// the next frame: the old per-entry deep equals on every change was the
		// dominant cost of an APL edit (~166 ms on a large rotation).
		const unsub = this.config.subscribe(() => this.scheduleChecks());
		this.addOnDisposeCallback(() => unsub());

		if (config.extraCssClasses) this.rootElem.classList.add(...config.extraCssClasses);

		const contentBlock = new ContentBlock(this.rootElem, 'saved-data', { header: config.header });

		const savedDataRef = ref<HTMLDivElement>();
		const presetDataRef = ref<HTMLDivElement>();
		const customDataRef = ref<HTMLDivElement>();
		contentBlock.bodyElement.replaceChildren(
			<div ref={savedDataRef} className="saved-data-container">
				<div ref={presetDataRef} className="saved-data-presets hide" />
				<div ref={customDataRef} className="saved-data-custom hide" />
			</div>,
		);

		this.savedDataDiv = savedDataRef.value!;
		this.presetDataDiv = presetDataRef.value!;
		this.customDataDiv = customDataRef.value!;

		if (!config.presetsOnly && !this.config.loadOnly) {
			contentBlock.bodyElement.appendChild(this.buildCreateContainer());
		}
	}

	addSavedData(config: SavedDataConfig<ModObject, T>) {
		const newData = this.makeSavedData(config);
		const dataArr = config.isPreset ? this.presets : this.userData;
		const oldIdx = dataArr.findIndex(data => data.name === config.name);

		if (oldIdx === -1) {
			if (config.isPreset) {
				this.presetDataDiv.classList.remove('hide');
				this.presetDataDiv.appendChild(newData.elem);
			} else {
				this.customDataDiv.classList.remove('hide');
				this.customDataDiv.appendChild(newData.elem);
			}
			dataArr.push(newData);
		} else {
			dataArr[oldIdx].elem.replaceWith(newData.elem);
			dataArr[oldIdx] = newData;
		}
		this.scheduleChecks();
	}

	private makeSavedData(config: SavedDataConfig<ModObject, T>): SavedData<ModObject, T> {
		const deleteButtonRef = ref<HTMLButtonElement>();
		const dataElem = (
			<div className="saved-data-set-chip badge rounded-pill">
				<button type="button" className="saved-data-set-name">
					{config.name}
				</button>
				{!this.config.loadOnly && !config.isPreset && (
					<button type="button" ref={deleteButtonRef} className="saved-data-set-delete">
						<i className="fa fa-times fa-lg"></i>
					</button>
				)}
			</div>
		) as HTMLElement;

		dataElem?.addEventListener('click', () => {
			this.config.setData(this.modObject, config.data);
			config.onLoad?.(this.modObject);
			// Run the deferred check now so the clicked entry's name is the one left in the input.
			this.flushChecks();
			if (this.saveInput) this.saveInput.value = config.name;
			trackEvent({
				action: 'settings',
				category: 'load',
				label: this.config.label,
			});
		});

		if (!this.config.loadOnly && !config.isPreset && deleteButtonRef.value) {
			const tooltip = tippy(deleteButtonRef.value, { content: this.config.deleteTooltip || `Delete saved ${this.config.label}` });
			deleteButtonRef.value.addEventListener('click', event => {
				event.stopPropagation();
				const shouldDelete = confirm(
					this.config.deleteConfirmMessage
						? this.config.deleteConfirmMessage.replace('{{name}}', config.name)
						: `Delete saved ${this.config.label} '${config.name}'?`,
				);
				if (!shouldDelete) return;

				tooltip.destroy();

				const idx = this.userData.findIndex(data => data.name === config.name);
				this.userData[idx].elem.remove();
				this.userData.splice(idx, 1);
				this.saveUserData();

				trackEvent({
					action: 'settings',
					category: 'delete',
					label: this.config.label,
				});
			});
		}

		if (config.tooltip) {
			tippy(dataElem, {
				content: config.tooltip,
				placement: 'bottom',
			});
		}

		const savedData: SavedData<ModObject, T> = {
			name: config.name,
			data: config.data,
			dataJson: this.serialize(config.data),
			elem: dataElem,
			enableWhen: config.enableWhen,
			onLoad: config.onLoad,
		};
		return savedData;
	}

	private serialize(data: T): string | undefined {
		return this.config.equals ? undefined : JSON.stringify(this.config.toJson(data));
	}

	private scheduleChecks() {
		if (this.pendingCheckFrame != null) return;
		this.pendingCheckFrame = requestAnimationFrame(() => {
			this.pendingCheckFrame = null;
			this.runChecks();
		});
	}

	private flushChecks() {
		if (this.pendingCheckFrame == null) return;
		cancelAnimationFrame(this.pendingCheckFrame);
		this.pendingCheckFrame = null;
		this.runChecks();
	}

	private runChecks() {
		if (!this.presets.length && !this.userData.length) return;
		const current = this.config.getData(this.modObject);
		const currentJson = this.serialize(current);
		// Presets last so, with identical data, the preset's name wins in the save input (as before).
		this.userData.forEach(entry => this.checkEntry(entry, current, currentJson));
		this.presets.forEach(entry => this.checkEntry(entry, current, currentJson));
	}

	private checkEntry(entry: SavedData<ModObject, T>, current: T, currentJson: string | undefined) {
		const isActive = this.config.equals ? this.config.equals(entry.data, current) : entry.dataJson === currentJson;
		if (isActive) {
			entry.elem.classList.add('active');
			if (this.saveInput) this.saveInput.value = entry.name;
		} else {
			entry.elem.classList.remove('active');
		}

		if (entry.enableWhen && !entry.enableWhen(this.modObject)) {
			entry.elem.classList.add('disabled');
		} else {
			entry.elem.classList.remove('disabled');
		}
	}

	// Save data to window.localStorage.
	private saveUserData() {
		const userData: Record<string, unknown> = {};
		this.userData.forEach(savedData => {
			userData[savedData.name] = this.config.toJson(savedData.data);
		});

		if (!this.presets.length) {
			this.presetDataDiv.classList.add('hide');
		}
		if (!this.userData.length) {
			this.customDataDiv.classList.add('hide');
		}

		window.localStorage.setItem(this.config.storageKey, JSON.stringify(userData));
	}

	// Load data from window.localStorage.
	loadUserData() {
		if (this.config.presetsOnly) return;

		const dataStr = window.localStorage.getItem(this.config.storageKey);
		if (!dataStr) return;

		let jsonData;
		try {
			jsonData = JSON.parse(dataStr);
		} catch (e) {
			console.warn('Invalid json for local storage value: ', dataStr, e);
		}

		for (const name in jsonData) {
			try {
				this.addSavedData({
					name: name,
					data: this.config.fromJson(jsonData[name]),
				});
			} catch (e) {
				console.warn('Failed parsing saved data: ', jsonData[name], e);
			}
		}
	}

	// Prevent user input from creating / deleting saved data.
	freeze() {
		this.frozen = true;
		this.rootElem.classList.add('frozen');
	}

	private buildCreateContainer(): HTMLElement {
		const saveButtonRef = ref<HTMLButtonElement>();
		const saveInputRef = ref<HTMLInputElement>();
		const savedDataCreateFragment = (
			<div className="saved-data-create-container">
				<label className="form-label">{this.config.nameLabel || i18n.t('common.name')}</label>
				<input ref={saveInputRef} className="saved-data-save-input form-control" type="text" placeholder={i18n.t('common.name')} />
				<button type="button" ref={saveButtonRef} className="saved-data-save-button btn btn-primary">
					{this.config.saveButtonText || `Save ${this.config.label}`}
				</button>
			</div>
		) as HTMLElement;

		this.saveInput = saveInputRef.value!;
		saveButtonRef.value?.addEventListener('click', () => {
			if (this.frozen) return;

			const newName = this.saveInput?.value;
			if (!newName) {
				alert(this.config.chooseNameAlert || `Choose a label for your saved ${this.config.label}!`);
				return;
			}

			if (newName in this.presets) {
				alert(
					this.config.nameExistsAlert
						? this.config.nameExistsAlert.replace('{{name}}', newName)
						: `${this.config.label} with name ${newName} already exists.`,
				);
				return;
			}
			this.addSavedData({
				name: newName,
				data: this.config.getData(this.modObject),
			});
			this.saveUserData();
			trackEvent({
				action: 'settings',
				category: 'save',
				label: this.config.label,
			});
		});

		return savedDataCreateFragment;
	}
}
