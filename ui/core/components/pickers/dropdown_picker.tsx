import { Dropdown } from 'bootstrap';
import clsx from 'clsx';
import { shallowEqualArrays, shallowEqualObjects } from 'shallow-equal';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import i18n from '../../../i18n/config';
import { nextEventID } from '../../state/batch';
import { arrayEquals, existsInDOM } from '../../utils.js';
import { Input, InputConfig } from '../input.js';
export interface DropdownValueConfig<V> {
	value: V;
	submenu?: (string | V)[];
	headerText?: string;
	tooltip?: string;
	extraCssClasses?: string[];
}

export interface DropdownPickerConfig<ModObject, T, V = T> extends InputConfig<ModObject, T, V> {
	id: string;
	values: DropdownValueConfig<V>[];
	equals: (a: V | undefined, b: V | undefined) => boolean;
	setOptionContent: (button: HTMLButtonElement, valueConfig: DropdownValueConfig<V>, isSelectButton?: boolean) => void;
	createMissingValue?: (val: V) => Promise<DropdownValueConfig<V>>;
	defaultLabel: string;
}

interface DropdownSubmenu<V> {
	path: (string | V)[];
	listElem: HTMLUListElement;
}

/** UI Input that uses a dropdown menu. */
export class DropdownPicker<ModObject, T, V = T> extends Input<ModObject, T, V> {
	private readonly config: DropdownPickerConfig<ModObject, T, V>;
	private valueConfigs: DropdownValueConfig<V>[];

	private readonly buttonElem: HTMLButtonElement;
	private readonly listElem: HTMLUListElement;

	private currentSelection: DropdownValueConfig<V> | null;
	private submenus: Array<DropdownSubmenu<V>>;

	private resetCallbacks: (() => void)[] = [];
	// Guards async createMissingValue resolutions against later setInputValue calls.
	private setValueSeq = 0;

	constructor(parent: HTMLElement | null, modObject: ModObject, config: DropdownPickerConfig<ModObject, T, V>) {
		super(parent, 'dropdown-picker-root', modObject, config);
		this.config = config;
		this.valueConfigs = this.config.values.filter(vc => !vc.headerText);
		this.currentSelection = null;
		this.submenus = [];

		this.rootElem.classList.add('dropdown');

		const buttonRef = ref<HTMLButtonElement>();
		const listRef = ref<HTMLUListElement>();
		this.rootElem.appendChild(
			<>
				<button
					ref={buttonRef}
					id={config.id}
					className="dropdown-picker-button btn dropdown-toggle open-on-click"
					dataset={{ bsToggle: 'dropdown' }}
					attributes={{ 'aria-expanded': false }}>
					{config.defaultLabel}
				</button>
				<ul ref={listRef} className="dropdown-picker-list dropdown-menu"></ul>
			</>,
		);

		this.buttonElem = buttonRef.value!;
		this.listElem = listRef.value!;

		this.buttonElem.addEventListener(
			'show.bs.dropdown',
			() => {
				this.renderDropdown(this.valueConfigs);
			},
			{ signal: this.signal },
		);
		this.buttonElem.addEventListener(
			'hidden.bs.dropdown',
			() => {
				this.resetDropdown();
			},
			{ signal: this.signal },
		);

		this.init();

		this.addOnDisposeCallback(() => {
			this.resetDropdown();
			this.listElem.remove();
			Dropdown.getOrCreateInstance(this.buttonElem).dispose();
			this.buttonElem.remove();
		});
	}

	setOptions(newValueConfigs: DropdownValueConfig<V>[]) {
		const roomExistsInDOM = existsInDOM(this.rootElem);
		const listExistsInDOM = existsInDOM(this.listElem);
		const buttonExistsInDOM = existsInDOM(this.buttonElem);

		if (!roomExistsInDOM || !buttonExistsInDOM || !listExistsInDOM) {
			this.dispose();
			return;
		}

		const filtered = newValueConfigs.filter(vc => !vc.headerText);
		// Keep the existing config objects when nothing changed: every APL
		// action-id picker refreshes its options on each rotation change, and a
		// fresh-but-equal list would force a button re-render per picker.
		if (arrayEquals(filtered, this.valueConfigs, (a, b) => this.isSameOption(a, b))) {
			return;
		}
		this.valueConfigs = filtered;
		this.setInputValue(this.getSourceValue());
		return;
	}

	// True when two option configs would render identically: equal values plus
	// identical display fields, including those of an object value (e.g. a
	// UnitValue's text/icon/color, which `equals` deliberately ignores).
	private isSameOption(a: DropdownValueConfig<V>, b: DropdownValueConfig<V>): boolean {
		const { value: aValue, submenu: aSubmenu, extraCssClasses: aClasses, ...aRest } = a;
		const { value: bValue, submenu: bSubmenu, extraCssClasses: bClasses, ...bRest } = b;
		if (!this.config.equals(aValue, bValue)) return false;
		// The array fields are rebuilt per refresh, so compare them by content.
		if (!shallowEqualObjects(aRest, bRest) || !shallowEqualArrays(aSubmenu, bSubmenu) || !shallowEqualArrays(aClasses, bClasses)) return false;
		if (aValue === bValue || typeof aValue !== 'object' || aValue === null || typeof bValue !== 'object' || bValue === null) return true;
		return shallowEqualObjects(aValue as Record<string, unknown>, bValue as Record<string, unknown>);
	}

	resetDropdown() {
		this.listElem.querySelectorAll('[data-bs-toggle=dropdown]').forEach(elem => Dropdown.getOrCreateInstance(elem).dispose());
		this.resetCallbacks.forEach(callback => callback());
		this.listElem.replaceChildren(<></>);
	}

	private renderDropdown(valueConfigs: DropdownValueConfig<V>[]) {
		this.listElem.replaceChildren();
		this.submenus = [];
		valueConfigs.forEach(valueConfig => {
			const containsSubmenuChildren = valueConfigs.some(vc => vc.submenu?.some(e => !(typeof e == 'string') && this.config.equals(e, valueConfig.value)));
			const buttonRef = ref<HTMLButtonElement>();
			const listItemRef = ref<HTMLLIElement>();
			const itemElem = (
				<li ref={listItemRef} className={clsx(valueConfig.extraCssClasses, valueConfig.headerText ? 'dropdown-picker-header' : 'dropdown-picker-item')}>
					{valueConfig.headerText && <h6 className="dropdown-header">{valueConfig.headerText}</h6>}
				</li>
			);

			if (!valueConfig.headerText) {
				const buttonElem = <button ref={buttonRef} className="dropdown-item" />;
				this.config.setOptionContent(buttonRef.value!, valueConfig);

				if (valueConfig.tooltip) {
					const tooltip = tippy(buttonRef.value!, {
						animation: false,
						theme: 'dropdown-tooltip',
						content: valueConfig.tooltip,
					});
					this.addOnResetCallback(() => tooltip?.destroy());
				}
				const onButtonClick = () => {
					this.updateValue(valueConfig);
					this.inputChanged(nextEventID());
				};
				buttonRef.value!.addEventListener('click', onButtonClick);
				this.addOnResetCallback(() => {
					buttonRef.value?.removeEventListener('click', onButtonClick);
					buttonRef.value?.remove();
					itemElem.remove();
				});

				if (containsSubmenuChildren) {
					this.createSubmenu((valueConfig.submenu || []).concat([valueConfig.value]), buttonRef.value!, listItemRef.value!);
				} else {
					itemElem.appendChild(buttonElem);
				}
			}

			if (!containsSubmenuChildren) {
				if (valueConfig.submenu && valueConfig.submenu.length > 0) {
					this.createSubmenu(valueConfig.submenu);
				}
				const submenu = this.getSubmenu(valueConfig.submenu);
				if (submenu) {
					submenu.listElem.appendChild(itemElem);
				} else {
					this.listElem.appendChild(itemElem);
				}
			}
		});
	}

	private getSubmenu(path: (string | V)[] | undefined): DropdownSubmenu<V> | null {
		if (!path) {
			return null;
		}
		return this.submenus.find(submenu => this.equalPaths(submenu.path, path)) || null;
	}

	private createSubmenu(path: (string | V)[], buttonElem?: HTMLButtonElement, itemElem?: HTMLLIElement): DropdownSubmenu<V> {
		const submenu = this.getSubmenu(path);
		if (submenu) return submenu;

		let parent: DropdownSubmenu<V> | null = null;
		if (path.length > 1) parent = this.createSubmenu(path.slice(0, path.length - 1));

		if (!itemElem) itemElem = (<li className="dropdown-picker-item" />) as HTMLLIElement;

		if (!buttonElem) buttonElem = (<button className="dropdown-item" />) as HTMLButtonElement;

		buttonElem.setAttribute('data-bs-toggle', 'dropdown');
		buttonElem.setAttribute('aria-expanded', 'false');

		if (!buttonElem.childNodes.length) {
			const submenuText = path[path.length - 1];
			// Only translate if it's a string
			let translatedText = submenuText;
			if (typeof submenuText === 'string' && /^[a-z_]+$/.test(submenuText)) {
				try {
					translatedText = i18n.t(`rotation_tab.apl.submenus.${submenuText}`);
				} catch {
					translatedText = submenuText;
				}
			}
			buttonElem.replaceChildren(translatedText + ' \u00bb');
		}

		const listRef = ref<HTMLUListElement>();

		itemElem.appendChild(
			<div className="dropend">
				{buttonElem}
				<ul ref={listRef} className="dropdown-submenu dropdown-menu"></ul>
			</div>,
		);

		(parent?.listElem || this.listElem).appendChild(itemElem);

		const newSubmenu = {
			path: path,
			listElem: listRef.value!,
		};
		this.submenus.push(newSubmenu);
		return newSubmenu;
	}

	private equalPaths(a: (string | V)[] | null | undefined, b: (string | V)[] | null | undefined): boolean {
		return (
			(a?.length || 0) == (b?.length || 0) &&
			(a || []).every((aVal, i) => (typeof aVal == 'string' ? aVal == (b![i] as string) : this.config.equals(aVal, b![i] as V)))
		);
	}

	getInputElem(): HTMLElement {
		return this.listElem;
	}

	getInputValue(): T {
		return this.valueToSource(this.currentSelection?.value as V);
	}

	setInputValue(newSrcValue: T) {
		const seq = ++this.setValueSeq;
		const newValue = this.sourceToValue(newSrcValue);
		const newSelection = this.valueConfigs.find(v => this.config.equals(v.value, newValue))!;
		if (newSelection) {
			this.updateValue(newSelection);
		} else if (newValue == null) {
			this.updateValue(null);
		} else if (this.config.createMissingValue) {
			this.config.createMissingValue(newValue).then(newSelection => {
				// A newer setInputValue (or disposal) happened while awaiting.
				if (seq !== this.setValueSeq || this.isDisposed) return;
				this.updateValue(newSelection);
			});
		} else {
			this.updateValue(null);
		}
	}

	private updateValue(newValue: DropdownValueConfig<V> | null) {
		// Same selection object as already rendered: nothing to do. This is the
		// hot path when a rotation edit re-syncs every dropdown in the APL editor.
		if (newValue && newValue === this.currentSelection) {
			return;
		}
		this.currentSelection = newValue;

		// Update button
		if (newValue) {
			this.buttonElem.innerHTML = '';
			this.config.setOptionContent(this.buttonElem, newValue, true);
		} else {
			this.buttonElem.textContent = this.config.defaultLabel;
		}
	}

	addOnResetCallback(callback: () => void) {
		this.resetCallbacks.push(callback);
	}
}

export interface TextDropdownValueConfig<T> extends DropdownValueConfig<T> {
	label: string;
}

export interface TextDropdownPickerConfig<ModObject, T> extends Omit<DropdownPickerConfig<ModObject, T>, 'values' | 'setOptionContent'> {
	values: Array<TextDropdownValueConfig<T>>;
}

export class TextDropdownPicker<ModObject, T> extends DropdownPicker<ModObject, T> {
	constructor(parent: HTMLElement | null, modObject: ModObject, config: TextDropdownPickerConfig<ModObject, T>) {
		super(parent, modObject, {
			...config,
			setOptionContent: (button: HTMLButtonElement, valueConfig: DropdownValueConfig<T>) => {
				button.textContent = (valueConfig as TextDropdownValueConfig<T>).label;
			},
		});
	}
}
