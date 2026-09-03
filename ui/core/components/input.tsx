import clsx, { ClassValue } from 'clsx';
import tippy, { Content as TippyContent } from 'tippy.js';

import { EventID } from '../state/batch';
import { Emitter } from '../state/events.js';
import type { StoreSubscribe } from '../state/subscriptions';
import { existsInDOM } from '../utils';
import { Component } from './component.js';
/**
 * Data for creating a new input UI element.
 */
export interface InputConfig<ModObject, T, V = T> {
	label?: string;
	labelTooltip?: TippyContent;
	description?: string | Element;
	inline?: boolean;
	id?: string;
	extraCssClasses?: Array<string>;

	defaultValue?: T;

	// The input's change source: given the mod object, returns a subscribe
	// function (see state/subscriptions.ts). Omit for inputs that are re-synced
	// by their parent (nested APL pickers, UI-local toggles).
	storeSubscribe?: (obj: ModObject) => StoreSubscribe;

	// Get and set the mapped value.
	getValue: (obj: ModObject) => T;
	setValue: (eventID: EventID, obj: ModObject, newValue: T) => void;

	// If set, will automatically disable the input when this evaluates to false.
	enableWhen?: (obj: ModObject) => boolean;

	// If set, will automatically hide the input when this evaluates to false.
	showWhen?: (obj: ModObject) => boolean;

	// Overrides the default root element (new div).
	rootElem?: HTMLElement;

	// Convert between source value and input value types. In most cases this is not needed
	// because source and input use the same type. These functions must be set if T != V.
	sourceToValue?: (src: T) => V;
	valueToSource?: (val: V) => T;
}

// Shared logic for UI elements that are mapped to a value for some modifiable object.
export abstract class Input<ModObject, T, V = T> extends Component {
	readonly inputConfig: InputConfig<ModObject, T, V>;
	readonly modObject: ModObject;

	protected enabled = true;
	readonly changeEmitter = new Emitter<void>();
	// Can be used to remove any events in addEventListener
	// https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#add_an_abortable_listener
	public abortController: AbortController;
	public signal: AbortSignal;

	constructor(parent: HTMLElement | null, cssClass: string, modObject: ModObject, config: InputConfig<ModObject, T, V>) {
		super(parent, 'input-root', config.rootElem);
		this.abortController = new AbortController();
		this.signal = this.abortController.signal;
		this.inputConfig = config;
		this.modObject = modObject;
		this.rootElem.classList.add(cssClass);

		if (config.inline) this.rootElem.classList.add('input-inline');
		if (config.extraCssClasses) this.rootElem.classList.add(...config.extraCssClasses);
		if (config.label) this.rootElem.appendChild(this.buildLabel(config));
		if (config.description) this.rootElem.appendChild(this.buildDescription(config));

		const onSourceChange = () => {
			const element = this.getInputElem();
			if (!existsInDOM(element) || !existsInDOM(this.rootElem)) {
				this.dispose();
				return;
			}
			this.setInputValue(this.getSourceValue());
			this.update();
		};
		const disposeSubscription = this.subscribeToSource(onSourceChange);

		this.addOnDisposeCallback(() => {
			this.abortController?.abort();
			disposeSubscription();
		});
	}

	// Subscribes `listener` to this input's source (no-op without one). Returns
	// the unsubscribe function.
	protected subscribeToSource(listener: () => void): () => void {
		return this.inputConfig.storeSubscribe ? this.inputConfig.storeSubscribe(this.modObject)(listener) : () => {};
	}

	private buildLabel(config: InputConfig<ModObject, T, V>): JSX.Element {
		const label = (
			<label htmlFor={config.id || undefined} className="form-label" title={config.label}>
				{config.label}
			</label>
		);

		if (config.labelTooltip) {
			const tippyInstance = tippy(label, {
				content: config.labelTooltip,
			});
			this.addOnDisposeCallback(() => tippyInstance.destroy());
		}

		return label;
	}

	private buildDescription(config: InputConfig<ModObject, T, V>): JSX.Element {
		return <div className="input-description">{config.description}</div>;
	}

	update() {
		const enable = !this.inputConfig.enableWhen || this.inputConfig.enableWhen(this.modObject);
		if (enable) {
			this.enabled = true;
			this.rootElem.classList.remove('disabled');
			this.getInputElem()?.removeAttribute('disabled');
		} else {
			this.enabled = false;
			this.rootElem.classList.add('disabled');
			this.getInputElem()?.setAttribute('disabled', '');
		}

		const show = !this.inputConfig.showWhen || this.inputConfig.showWhen(this.modObject);
		if (show) {
			this.rootElem.classList.remove('hide');
		} else {
			this.rootElem.classList.add('hide');
		}
	}

	// Re-reads the mapped value from the source and re-applies enable/show state.
	refresh() {
		this.setInputValue(this.getSourceValue());
		this.update();
	}

	// Can't call abstract functions in constructor, so need an init() call.
	init() {
		const initialValue = this.inputConfig.defaultValue ? this.inputConfig.defaultValue : this.inputConfig.getValue(this.modObject);
		this.setInputValue(initialValue);
		this.update();
	}

	abstract getInputElem(): HTMLElement | null;

	abstract getInputValue(): T;

	abstract setInputValue(newValue: T): void;

	protected getSourceValue(): T {
		return this.inputConfig.getValue(this.modObject);
	}

	protected setSourceValue(eventID: EventID, newValue: T) {
		this.inputConfig.setValue(eventID, this.modObject, newValue);
	}

	protected sourceToValue(src: T): V {
		return this.inputConfig.sourceToValue ? this.inputConfig.sourceToValue(src) : (src as unknown as V);
	}
	protected valueToSource(val: V): T {
		return this.inputConfig.valueToSource ? this.inputConfig.valueToSource(val) : (val as unknown as T);
	}

	// Child classes should call this method when the value in the input element changes.
	inputChanged(eventID: EventID) {
		this.setSourceValue(eventID, this.getInputValue());
		this.changeEmitter.emit();
	}

	// Sets the underlying value directly.
	setValue(eventID: EventID, newValue: T) {
		this.inputConfig.setValue(eventID, this.modObject, newValue);
	}

	static newGroupContainer(className?: ClassValue): HTMLElement {
		return (<div className={clsx('picker-group', className)} />) as HTMLElement;
	}
}
