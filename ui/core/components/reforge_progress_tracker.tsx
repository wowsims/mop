import { Component } from './component.js';

export interface ReforgeProgressState {
	stage: 'initializing' | 'solving' | 'checking-caps' | 'complete' | 'error';
	iteration: number;
	maxIterations: number;
	constraintIteration: number;
	maxConstraintIterations: number;
	timeElapsed: number;
	timeRemaining?: number;
	message: string;
}

interface ReforgeProgressTrackerOptions {
	onCancel?: () => void;
	onComplete?: () => void;
}

export class ReforgeProgressTracker extends Component {
	private progressState: ReforgeProgressState = {
		stage: 'initializing',
		iteration: 0,
		maxIterations: 5000000,
		constraintIteration: 0,
		maxConstraintIterations: 10,
		timeElapsed: 0,
		message: 'Initializing optimization...'
	};

	private progressBar: HTMLElement;
	private messageElement: HTMLElement;
	private detailsElement: HTMLElement;
	private timeElement: HTMLElement;
	private modal: HTMLElement;
	private startTime: number = 0;
	private updateInterval: number | null = null;

	constructor(parent: HTMLElement, options: ReforgeProgressTrackerOptions = {}) {
		super(parent);

		// Create modal overlay
		this.modal = this.buildModal(options);
		document.body.appendChild(this.modal);

		this.progressBar = this.modal.querySelector('.progress-bar-fill')!;
		this.messageElement = this.modal.querySelector('.progress-message')!;
		this.detailsElement = this.modal.querySelector('.progress-details')!;
		this.timeElement = this.modal.querySelector('.progress-time')!;
	}

	private buildModal(options: ReforgeProgressTrackerOptions): HTMLElement {
		const modal = document.createElement('div');
		modal.className = 'reforge-progress-modal';
		modal.innerHTML = `
			<div class="reforge-progress-overlay"></div>
			<div class="reforge-progress-content">
				<h3>Optimizing Reforges</h3>
				<div class="progress-message">Initializing optimization...</div>
				<div class="progress-bar">
					<div class="progress-bar-fill"></div>
				</div>
				<div class="progress-details">
					<div class="progress-iteration">Iteration: <span class="current-iteration">0</span> / <span class="max-iteration">5,000,000</span></div>
					<div class="progress-constraint">Constraint Pass: <span class="current-constraint">0</span> / <span class="max-constraint">10</span></div>
				</div>
				<div class="progress-time">
					<span class="time-elapsed">0s</span> elapsed
					<span class="time-remaining"></span>
				</div>
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
		const { stage, iteration, maxIterations, constraintIteration, maxConstraintIterations, message } = this.progressState;

		// Update data-stage attribute for CSS styling
		const contentEl = this.modal.querySelector('.reforge-progress-content') as HTMLElement;
		if (contentEl) {
			contentEl.setAttribute('data-stage', stage);
		}

		// Update message
		this.messageElement.textContent = message;

		// Calculate overall progress
		let overallProgress = 0;
		switch (stage) {
			case 'initializing':
				overallProgress = 5;
				break;
			case 'solving':
				// Progress within current constraint iteration
				const iterationProgress = (iteration / maxIterations) * 80; // 80% for solving
				const constraintProgress = (constraintIteration / maxConstraintIterations) * 80;
				overallProgress = 5 + Math.max(iterationProgress, constraintProgress);
				break;
			case 'checking-caps':
				overallProgress = 90;
				break;
			case 'complete':
				overallProgress = 100;
				break;
			case 'error':
				overallProgress = this.progressState.iteration > 0 ? 50 : 10;
				break;
		}

		// Update progress bar
		this.progressBar.style.width = `${Math.min(100, overallProgress)}%`;

		// Update details
		const currentIterationEl = this.detailsElement.querySelector('.current-iteration')!;
		const maxIterationEl = this.detailsElement.querySelector('.max-iteration')!;
		const currentConstraintEl = this.detailsElement.querySelector('.current-constraint')!;
		const maxConstraintEl = this.detailsElement.querySelector('.max-constraint')!;

		currentIterationEl.textContent = iteration.toLocaleString();
		maxIterationEl.textContent = maxIterations.toLocaleString();
		currentConstraintEl.textContent = constraintIteration.toString();
		maxConstraintEl.textContent = maxConstraintIterations.toString();
	}

	private updateTimeDisplay(): void {
		if (!this.startTime) return;

		const elapsed = (Date.now() - this.startTime) / 1000;
		this.progressState.timeElapsed = elapsed;

		const elapsedEl = this.timeElement.querySelector('.time-elapsed')!;
		const remainingEl = this.timeElement.querySelector('.time-remaining')!;

		elapsedEl.textContent = `${elapsed.toFixed(1)}s`;

		// Estimate remaining time based on progress and stage
		if (this.progressState.stage === 'solving' && this.progressState.iteration > 1000) {
			const iterationsPerSecond = this.progressState.iteration / elapsed;
			const remainingIterations = this.progressState.maxIterations - this.progressState.iteration;
			const estimatedRemaining = remainingIterations / iterationsPerSecond;

			if (estimatedRemaining > 0 && estimatedRemaining < 300) { // Only show if reasonable estimate
				remainingEl.textContent = ` • ~${estimatedRemaining.toFixed(0)}s remaining`;
			}
		}
	}

	destroy(): void {
		this.hide();
		if (this.modal.parentNode) {
			this.modal.parentNode.removeChild(this.modal);
		}
	}
}
