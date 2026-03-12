import clsx from 'clsx';
import { BaseModal } from './base_modal.js';
import { Component } from './component.js';
import { ref } from 'tsx-vanilla';
import i18n from '../../i18n/config.js';

export interface ProgressTrackerModalState {
	stage: 'initializing' | 'complete' | 'error' | string;
	message?: string;
}

interface ProgressTrackerModalOptions {
	id: string;
	onCancel?: () => void;
	onComplete?: () => void;
	title: string;
	warning?: string | Element;
	initializingMessage?: string;
}

export class ProgressTrackerModal extends Component {
	private progressState: ProgressTrackerModalState;

	readonly id: string;
	private modal: BaseModal;
	private startTime: number = 0;
	private updateInterval: number | null = null;

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

		const messageRef = ref<HTMLDivElement>();
		const contentRef = ref<HTMLDivElement>();
		const elapsedRef = ref<HTMLSpanElement>();

		this.modal.body.replaceChildren(
			<div className="progress-tracker-modal-modal">
				<div className="progress-tracker-modal-overlay"></div>
				<div className="progress-tracker-modal-content" ref={contentRef}>
					{options.warning && <div className="progress-tracker-modal-warning">{options.warning}</div>}
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
		const { stage, message } = this.progressState;

		// Update data-stage attribute for CSS styling
		if (this.contentElement) this.contentElement.dataset.stage = stage;

		if (!this.messageElement) return;

		this.messageElement.classList[message ? 'remove' : 'add']('d-none');
		this.messageElement.textContent = message || '';
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
