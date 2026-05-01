import i18n from '../../../../i18n/config';
import { IndividualSimUI } from '../../../individual_sim_ui';
import { Player } from '../../../player';
import { TypedEvent } from '../../../typed_event';
import { Component } from '../../component';
import { ListPicker } from '../../pickers/list_picker';
import { APLNameModal } from './apl_name_modal';

export type AplFloatingActionBarConfig = {
	itemName: string;
	modalTitle?: string;
	inputLabel?: string;
	inputPlaceholder?: string;
	getExistingNames?: () => string[];
	createItem?: (name: string) => any;
};

export class AplFloatingActionBar extends Component {
	constructor(parent: HTMLElement, simUI: IndividualSimUI<any>, listPicker: ListPicker<Player<any>, any>, config: AplFloatingActionBarConfig) {
		super(parent, 'apl-floating-action-bar-root');

		const newButton = this.rootElem.appendChild(
			<button className="btn btn-primary">
				<i className="fas fa-plus me-2" />
				{i18n.t('rotation_tab.apl.floatingActionBar.new', { itemName: config.itemName })}
			</button>,
		);

		newButton.addEventListener('click', () => {
			if (config.createItem) {
				new APLNameModal(simUI.rootElem, {
					title: config.modalTitle!,
					inputLabel: config.inputLabel!,
					inputPlaceholder: config.inputPlaceholder,
					existingNames: config.getExistingNames!(),
					onSubmit: (name: string) => {
						const newItem = config.createItem!(name);
						const newList = listPicker.config.getValue(listPicker.modObject).concat([newItem]);
						listPicker.config.setValue(TypedEvent.nextEventID(), listPicker.modObject, newList);
					},
				});
			} else {
				const newItem = listPicker.config.newItem();
				const newList = listPicker.config.getValue(listPicker.modObject).concat([newItem]);
				listPicker.config.setValue(TypedEvent.nextEventID(), listPicker.modObject, newList);
			}
		});

		const resetButton = this.rootElem.appendChild(
			<button className="btn btn-sm btn-link btn-reset ms-auto">
				<i className="fas fa-times me-1"></i>
				{i18n.t('rotation_tab.apl.floatingActionBar.reset')}
			</button>,
		);

		resetButton.addEventListener('click', () => {
			simUI.applyEmptyAplRotation(TypedEvent.nextEventID());
		});

		new IntersectionObserver(
			([e]) => {
				e.target.classList.toggle('stuck');
			},
			{
				root: parent,
				rootMargin: '-100% 0px 0px 0px',
			},
		).observe(this.rootElem);
	}
}
