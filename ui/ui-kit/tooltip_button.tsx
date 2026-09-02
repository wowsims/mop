import tippy from "tippy.js";

import { Component } from "./component";

export class TooltipButton extends Component {
	constructor(parent: HTMLElement, tooltip: string, extraCssClasses: Array<string> = []) {
		const button = (
			<button className="btn btn-link" type="button">
				<i className="far fa-question-circle" />
			</button>
		) as HTMLElement;
		button.classList.add(...extraCssClasses);

		super(parent, 'tooltip-button', button);

		const tippyInstance = tippy(button, {
			content: tooltip,
			allowHTML: true,
		});

		this.addOnDisposeCallback(() => tippyInstance?.destroy());
	}
}
