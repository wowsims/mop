import clsx from 'clsx';
import { BaseModal } from './base_modal.js';
import { Component } from './component.js';
import { ref } from 'tsx-vanilla';
import i18n from '../../i18n/config.js';

export interface ProgressTrackerModalState {
	stage: 'initializing' | 'complete' | 'error' | string;
	title?: string;
	message?: string | Element | DocumentFragment;
	current?: number;
	total?: number;
}

interface ProgressTrackerModalOptions {
	id: string;
	onCancel?: () => void;
	onComplete?: () => void;
	title: string;
	warning?: string | Element;
	initializingMessage?: string | Element | DocumentFragment;
	hasProgressBar?: boolean;
}

export class ProgressTrackerModal extends Component {
	private progressState: ProgressTrackerModalState;

	readonly id: string;
	private modal: BaseModal;
	private startTime: number = 0;
	private updateInterval: number | null = null;

	private progressBarElement: HTMLElement | null = null;
	private progressTitleElement: HTMLElement | null = null;
	private progressTextElement: HTMLElement | null = null;
	private messageElement: HTMLElement | null = null;
	private elapsedTimeElement: HTMLElement | null = null;
	private contentElement: HTMLElement | null = null;

	constructor(parent: HTMLElement, options: ProgressTrackerModalOptions) {
		super(null, undefined, parent);
		this.id = options.id;
		this.progressState = {
			stage: 'initializing',
			message: options.initializingMessage,
		};

		this.modal = new BaseModal(this.rootElem, clsx('progress-tracker-modal', options.id), {
			title: options.title,
			disposeOnClose: false,
			preventClose: true,
			size: 'md',
		});
		this.modal.rootElem.id = this.id;

		const progressBarRef = ref<HTMLDivElement>();
		const progressTitleRef = ref<HTMLDivElement>();
		const progressTextRef = ref<HTMLDivElement>();
		const messageRef = ref<HTMLDivElement>();
		const contentRef = ref<HTMLDivElement>();
		const elapsedRef = ref<HTMLSpanElement>();

		this.modal.body.replaceChildren(
			<div className="progress-tracker-modal-modal">
				<div className="progress-tracker-modal-overlay"></div>
				<div className="progress-tracker-modal-content" ref={contentRef}>
					{options.warning && <div className="progress-tracker-modal-warning">{options.warning}</div>}
					{options.hasProgressBar && (
						<div className="progress-tracker-modal-progress-container">
							<div className="progress-tracker-modal-progress-title mb-2" ref={progressTitleRef}>
								{this.progressState.title}
							</div>
							<div className="progress">
								<div
									ref={progressBarRef}
									className="progress-bar"
									attributes={{
										role: 'progressbar',
									}}
								/>
							</div>
							<div className="progress-tracker-modal-progress-text" ref={progressTextRef} />
						</div>
					)}
					<div className="progress-tracker-modal-time-display">
						<strong>{i18n.t('common.elapsed_time')}:</strong>{' '}
						<span className="time-elapsed" ref={elapsedRef}>
							0s
						</span>
					</div>
					<div
						className={clsx('progress-tracker-modal-message', !this.progressState.message && 'd-none')}
						dataset={{
							stage: this.progressState.stage,
						}}
						ref={messageRef}>
						{this.progressState.message}
					</div>
					{options.onCancel && (
						<button
							className="btn btn-outline-cancel progress-tracker-modal-cancel-btn"
							onclick={() => {
								options.onCancel?.();
								this.hide();
							}}>
							<i className="fa fa-ban me-1"></i>
							{i18n.t('sidebar.results.reference.cancel')}
						</button>
					)}
				</div>
			</div>,
		);

		this.elapsedTimeElement = elapsedRef.value!;
		this.progressTitleElement = progressTitleRef.value!;
		this.progressBarElement = progressBarRef.value!;
		this.progressTextElement = progressTextRef.value!;
		this.messageElement = messageRef.value!;
		this.contentElement = contentRef.value!;
	}

	show(): void {
		this.modal.open();
		this.startTime = Date.now();
		this.updateInterval = window.setInterval(() => this.updateTimeDisplay(), 100);
	}

	hide(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
		}

		// Ensure we give the modal enough time to finish opening
		// To solve a Bootstrap Modal bug where it will not close properly
		setTimeout(() => this.modal.close(), Math.max(0, 650 - (Date.now() - this.startTime)));
	}

	updateProgress(state: Partial<ProgressTrackerModalState>): void {
		this.progressState = { ...this.progressState, ...state };
		this.render();
	}

	private render(): void {
		const { stage, title, message, current, total } = this.progressState;

		// Update data-stage attribute for CSS styling
		if (this.contentElement) this.contentElement.dataset.stage = stage;

		if (!this.messageElement) return;

		this.messageElement.classList[message ? 'remove' : 'add']('d-none');

		if (message instanceof Element || message instanceof DocumentFragment) {
			this.messageElement.replaceChildren(message);
		} else if (typeof message === 'string') {
			this.messageElement.textContent = message;
		} else {
			this.messageElement.replaceChildren();
		}

		this.progressTitleElement?.classList[title ? 'remove' : 'add']('d-none');
		if (this.progressBarElement && current !== undefined && total !== undefined) {
			if (this.progressTitleElement && title) {
				this.progressTitleElement.textContent = title;
			}
			const currentRounded = Math.ceil(current);
			if (this.progressTextElement) {
				this.progressTextElement.textContent = `${currentRounded}/${total}`;
			}
			this.progressBarElement.style.width = `${(current / total) * 100}%`;

			this.progressBarElement.setAttribute('aria-valuenow', currentRounded.toString());
			this.progressBarElement.setAttribute('aria-valuemin', '0');
			this.progressBarElement.setAttribute('aria-valuemax', total.toString());
		}
	}

	private updateTimeDisplay(): void {
		if (!this.startTime || !this.elapsedTimeElement) return;

		const elapsed = (Date.now() - this.startTime) / 1000;

		// Format time nicely
		if (elapsed < 60) {
			this.elapsedTimeElement.textContent = `${elapsed.toFixed(1)}s`;
		} else {
			const minutes = Math.floor(elapsed / 60);
			const seconds = Math.floor(elapsed % 60);
			this.elapsedTimeElement.textContent = `${minutes}m ${seconds}s`;
		}
	}
}
