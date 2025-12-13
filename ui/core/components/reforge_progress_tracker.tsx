import { Component } from './component.js';

export interface ReforgeProgressState {
	stage: 'initializing' | 'solving' | 'checking-caps' | 'complete' | 'error';
	message: string;
}

interface ReforgeProgressTrackerOptions {
	onCancel?: () => void;
	onComplete?: () => void;
}

export class ReforgeProgressTracker extends Component {
	private progressState: ReforgeProgressState = {
		stage: 'initializing',
		message: 'Optimizing reforges...',
	};

	private messageElement: HTMLElement;
	private timeElement: HTMLElement;
	private modal: HTMLElement;
	private startTime: number = 0;
	private updateInterval: number | null = null;

	constructor(parent: HTMLElement, options: ReforgeProgressTrackerOptions = {}) {
		super(parent);

		// Create modal overlay
		this.modal = this.buildModal(options);
		document.body.appendChild(this.modal);

		this.messageElement = this.modal.querySelector('.progress-message')!;
		this.timeElement = this.modal.querySelector('.progress-time-display')!;
	}

	private buildModal(options: ReforgeProgressTrackerOptions): HTMLElement {
		const modal = document.createElement('div');
		modal.className = 'reforge-progress-modal';
		modal.innerHTML = `
			<div class="reforge-progress-overlay"></div>
			<div class="reforge-progress-content">
			<h3>Optimizing Reforges</h3>
			<div class="progress-warning">
				<p>Reforging can be a lengthy process, especially as specific stat caps and breakpoints come into play for classes. This may take a while, but be assured that the calculation will eventually complete.</p>
				<p>You may cancel this operation at any time using the button below.</p>
			</div>
			<div class="progress-time-display"
					<strong>Elapsed Time:</strong> <span class="time-elapsed">0s</span>
				</div>
				<div class="progress-message"></div>
				${options.onCancel ? '<button class="progress-cancel-btn">Cancel</button>' : ''}
			</div>
		`;

		// Add cancel handler if provided
		if (options.onCancel) {
			const cancelBtn = modal.querySelector('.progress-cancel-btn') as HTMLButtonElement;
			cancelBtn.addEventListener('click', () => {
				options.onCancel!();
				this.hide();
			});
		}

		return modal;
	}

	show(): void {
		this.modal.style.display = 'flex';
		this.startTime = Date.now();
		this.updateInterval = window.setInterval(() => this.updateTimeDisplay(), 100);
	}

	hide(): void {
		this.modal.style.display = 'none';
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
	}

	updateProgress(state: Partial<ReforgeProgressState>): void {
		this.progressState = { ...this.progressState, ...state };
		this.render();
	}

	private render(): void {
		const { stage, message } = this.progressState;

		// Update data-stage attribute for CSS styling
		const contentEl = this.modal.querySelector('.reforge-progress-content') as HTMLElement;
		if (contentEl) {
			contentEl.setAttribute('data-stage', stage);
		}

		// Update message (only shown on complete or error)
		if (stage === 'complete' || stage === 'error') {
			this.messageElement.textContent = message;
			this.messageElement.style.display = 'block';
		} else {
			this.messageElement.style.display = 'none';
		}
	}

	private updateTimeDisplay(): void {
		if (!this.startTime) return;

		const elapsed = (Date.now() - this.startTime) / 1000;
		const elapsedEl = this.timeElement.querySelector('.time-elapsed')!;
		
		// Format time nicely
		if (elapsed < 60) {
			elapsedEl.textContent = `${elapsed.toFixed(1)}s`;
		} else {
			const minutes = Math.floor(elapsed / 60);
			const seconds = Math.floor(elapsed % 60);
			elapsedEl.textContent = `${minutes}m ${seconds}s`;
		}
	}

	destroy(): void {
		this.hide();
		if (this.modal.parentNode) {
			this.modal.parentNode.removeChild(this.modal);
		}
	}
}
