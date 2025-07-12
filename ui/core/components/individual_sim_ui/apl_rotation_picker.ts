import { Player } from '../../player';
import { SimUI } from '../../sim_ui';
import { Component } from '../component';
import { APLRotationTabs } from './apl_rotation_tabs';

export class APLRotationPicker extends Component {
	constructor(parent: HTMLElement, simUI: SimUI, modPlayer: Player<any>) {
		super(parent, 'apl-rotation-picker-root');

		// Use the new tab-based interface
		new APLRotationTabs(this.rootElem, simUI, modPlayer);
	}
}
