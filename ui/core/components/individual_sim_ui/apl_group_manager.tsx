import { ref } from 'tsx-vanilla';

import { Player } from '../../player';
import { APLGroup } from '../../proto/apl';
import { EventID, TypedEvent } from '../../typed_event';
import { randomUUID } from '../../utils';
import { Component } from '../component';
import { Input, InputConfig } from '../input';
import { ListItemPickerConfig, ListPicker } from '../pickers/list_picker';
import { APLGroupEditor } from './apl_group_editor';

export interface APLGroupManagerConfig extends InputConfig<Player<any>, Array<APLGroup>> {}

export class APLGroupManager extends Input<Player<any>, Array<APLGroup>> {
	private readonly groupsPicker: ListPicker<Player<any>, APLGroup>;
	private readonly collapseButton: HTMLButtonElement;
	private readonly contentDiv: HTMLElement;
	private isCollapsed = true;

	constructor(parent: HTMLElement, player: Player<any>, config: APLGroupManagerConfig) {
		super(parent, 'apl-group-manager-root', player, config);

		// Create collapsible header
		const headerDiv = document.createElement('div');
		headerDiv.classList.add('apl-groups-header');
		this.rootElem.appendChild(headerDiv);

		this.collapseButton = document.createElement('button');
		this.collapseButton.classList.add('btn', 'btn-link', 'apl-groups-collapse-btn');
		this.collapseButton.innerHTML = '<i class="fas fa-chevron-right"></i> Action Groups';
		this.collapseButton.addEventListener('click', () => this.toggleCollapse());
		headerDiv.appendChild(this.collapseButton);

		// Create content container
		this.contentDiv = document.createElement('div');
		this.contentDiv.classList.add('apl-groups-content');
		this.rootElem.appendChild(this.contentDiv);

		this.groupsPicker = new ListPicker<Player<any>, APLGroup>(this.contentDiv, this.modObject, {
			extraCssClasses: ['apl-groups-picker'],
			title: 'Action Groups',
			titleTooltip: 'Define reusable action groups that can be referenced in your priority list.',
			itemLabel: 'Group',
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: () => this.getSourceValue() || [],
			setValue: (eventID: EventID, player: Player<any>, newValue: Array<APLGroup>) => {
				this.setSourceValue(eventID, newValue);
			},
			newItem: () =>
				APLGroup.create({
					name: 'new_group',
					actions: [],
					variables: [],
				}),
			copyItem: (oldItem: APLGroup) => APLGroup.clone(oldItem),
			newItemPicker: (
				parent: HTMLElement,
				listPicker: ListPicker<Player<any>, APLGroup>,
				index: number,
				config: ListItemPickerConfig<Player<any>, APLGroup>,
			) => new APLGroupEditor(parent, this.modObject, config),
			inlineMenuBar: true,
		});

		// Set initial collapsed state
		this.updateCollapseState();

		this.init();
	}

	private toggleCollapse() {
		this.isCollapsed = !this.isCollapsed;
		this.updateCollapseState();
	}

	private updateCollapseState() {
		if (this.isCollapsed) {
			this.contentDiv.style.display = 'none';
			this.collapseButton.innerHTML = '<i class="fas fa-chevron-right"></i> Action Groups';
			this.collapseButton.classList.add('collapsed');
		} else {
			this.contentDiv.style.display = 'block';
			this.collapseButton.innerHTML = '<i class="fas fa-chevron-down"></i> Action Groups';
			this.collapseButton.classList.remove('collapsed');
		}
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): Array<APLGroup> {
		return this.groupsPicker.getInputValue();
	}

	setInputValue(newValue: Array<APLGroup>) {
		this.groupsPicker.setInputValue(newValue || []);
	}
}
