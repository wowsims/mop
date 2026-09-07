/** @jsxImportSource @jsx-vanilla */
import type { WarningsRegistry } from '@features/results/model/warnings';
import type { ProgressMetrics } from '@generated/proto/api';
import i18n from '@i18n/config';
import { Component } from '@ui-kit/component';
import { SimToolbarItem } from '@ui-kit/sim_toolbar_item';
import tippy, { inlinePositioning, Instance as TippyInstance } from 'tippy.js';
import { ref } from 'tsx-vanilla';

import type { ResultsPanelHandle } from './results_panel_handle';

interface WarningLinkArgs {
	parent: HTMLElement;
	href?: string;
	text?: string;
	icon?: string;
	label?: string;
	tooltip?: HTMLElement | Element;
	classes?: string;
}

const TOOLTIP_HTML_BASE = <ul className="text-start ps-3 mb-0"></ul>;

export class ResultsViewer extends Component implements ResultsPanelHandle {
	readonly pendingElem: HTMLDivElement;
	readonly contentElem: HTMLDivElement;
	readonly warningElem: HTMLDivElement;
	readonly buttonWrapperElem: HTMLDivElement;
	private warningsLink: HTMLElement;

	private readonly warnings: WarningsRegistry;
	private warningsTooltip: TippyInstance | null = null;

	constructor(parentElem: HTMLElement, warnings: WarningsRegistry) {
		super(parentElem, 'results-viewer');
		this.warnings = warnings;

		const pendingElemRef = ref<HTMLDivElement>();
		const contentElemRef = ref<HTMLDivElement>();
		const warningElemRef = ref<HTMLDivElement>();
		const buttonElemRef = ref<HTMLDivElement>();

		this.rootElem.appendChild(
			<>
				<div ref={pendingElemRef} className="results-pending">
					<div className="loader"></div>
				</div>
				<div ref={contentElemRef} className="results-content"></div>
				<div ref={buttonElemRef} className="button-zone text-center"></div>
				<div ref={warningElemRef} className="warning-zone text-center"></div>
			</>,
		);
		this.pendingElem = pendingElemRef.value!;
		this.contentElem = contentElemRef.value!;
		this.warningElem = warningElemRef.value!;
		this.buttonWrapperElem = buttonElemRef.value!;

		this.warningsLink = this.addWarningsLink();
		this.addOnDisposeCallback(this.warnings.subscribe(() => this.updateWarnings()));
		this.updateWarnings();

		this.hideAll();
	}

	private addWarningLink({ parent, tooltip, classes, text, label, ...itemArgs }: WarningLinkArgs): HTMLElement {
		const itemRef = ref<HTMLButtonElement>();
		parent.appendChild(
			<SimToolbarItem linkRef={itemRef} buttonClassName={classes} {...itemArgs}>
				{text}
			</SimToolbarItem>,
		);

		if (label) itemRef.value!.setAttribute('aria-label', label);

		if (tooltip) {
			this.warningsTooltip = tippy(itemRef.value!, {
				appendTo: 'parent',
				content: tooltip,
				placement: 'bottom',
				inlinePositioning: true,
				plugins: [inlinePositioning],
			});
		}

		return itemRef.value!;
	}

	private addWarningsLink() {
		return this.addWarningLink({
			parent: this.warningElem,
			icon: 'fas fa-exclamation-triangle fa-3x',
			label: i18n.t('sidebar.warnings.label'),
			tooltip: TOOLTIP_HTML_BASE,
			classes: 'warning link-warning',
		}) as HTMLElement;
	}

	private updateWarnings() {
		const activeWarnings = this.warnings.getContents();

		const list = ((this.warningsTooltip?.props.content as Element)?.cloneNode(true) || <></>) as HTMLElement;
		if (list) list.innerHTML = '';
		list.appendChild(
			<>
				{activeWarnings?.map(warning => (
					<li>{warning}</li>
				))}
			</>,
		);

		this.warningsLink.parentElement?.classList?.[activeWarnings.length ? 'remove' : 'add']('hide');
		this.warningsTooltip?.setContent(list);
	}

	hideAll() {
		this.contentElem.style.display = 'none';
		this.pendingElem.style.display = 'none';
		this.buttonWrapperElem.style.display = 'none';
	}

	setPending() {
		this.contentElem.style.display = 'none';
		this.pendingElem.style.display = 'block';
	}

	setContent(html: Element | HTMLElement | string) {
		if (typeof html === 'string') {
			this.contentElem.innerHTML = html;
		} else {
			this.contentElem.replaceChildren(html);
		}
		this.contentElem.style.display = 'block';
		this.pendingElem.style.display = 'none';
	}

	setProgress(progress: ProgressMetrics) {
		this.setContent(
			<div className="results-sim">
				<div className="results-sim-dps damage-metrics">
					<span className="topline-result-avg">{progress.dps.toFixed(2)}</span>
				</div>
				<div className="results-sim-hps healing-metrics">
					<span className="topline-result-avg">{progress.hps.toFixed(2)}</span>
				</div>
				<div>
					{progress.presimRunning
						? i18n.t('sidebar.results.progress.presim_running')
						: `${progress.completedIterations} / ${progress.totalIterations}`}
					<br />
					{i18n.t('sidebar.results.progress.iterations_complete')}
				</div>
			</div>,
		);
	}

	addAbortButton(abortClicked: (event: MouseEvent) => void) {
		const buttonRef = ref<HTMLButtonElement>();
		const onClick = (event: MouseEvent) => {
			if (buttonRef.value) {
				buttonRef.value.disabled = true;
				buttonRef.value.innerText = i18n.t('sidebar.results.stopping');
			}
			abortClicked?.(event);
		};

		this.buttonWrapperElem.replaceChildren(
			<button ref={buttonRef} type="button" className="sim-abort-button" onclick={onClick}>
				<i className="fa fa-times fa-lg me-1" />
				{i18n.t('sidebar.results.stop')}
			</button>,
		);
		this.buttonWrapperElem.style.display = 'block';
	}

	removeAbortButton() {
		this.buttonWrapperElem.replaceChildren();
		this.buttonWrapperElem.style.display = 'none';
	}
}
