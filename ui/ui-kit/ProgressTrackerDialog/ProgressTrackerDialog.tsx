import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { Dialog } from '@ui-kit/Dialog';
import { Icon } from '@ui-kit/Icon';
import type { ReactNode, Ref } from 'react';

import { ElapsedTime } from './ElapsedTime';
import { ProgressTrackerBar } from './ProgressTrackerBar';
import type { ProgressTrackerHandle, ProgressTrackerState } from './types';

export interface ProgressTrackerDialogProps {
	open: boolean;
	title: string;
	state: ProgressTrackerState;
	className?: string;
	warning?: ReactNode;
	hasProgressBar?: boolean;
	onCancel?: () => void;
	ref?: Ref<ProgressTrackerHandle>;
	testId?: string;
}

export const ProgressTrackerDialog = ({ open, title, state, className, warning, hasProgressBar, onCancel, ref, testId }: ProgressTrackerDialogProps) => (
	<Dialog
		open={open}
		onOpenChange={() => {}}
		className={className}
		size="md"
		verticalAlign="center"
		title={title}
		preventClose
		keepMounted
		elevated
		testId={testId ?? 'progress-tracker-dialog'}>
		<div className="flex flex-col items-center gap-4 text-center" data-testid="progress-tracker-modal-content" data-stage={state.stage}>
			{warning && (
				<div className="border border-warning p-4 text-(length:--btn-font-size)" data-testid="progress-tracker-modal-warning">
					{warning}
				</div>
			)}
			{hasProgressBar && <ProgressTrackerBar running={open} ref={ref} />}
			<div data-testid="progress-tracker-modal-time-display">
				<strong>{i18n.t('common.elapsed_time')}:</strong> <ElapsedTime running={open} />
			</div>
			<div
				className={!state.message ? 'hidden' : undefined}
				data-testid="progress-tracker-modal-message"
				data-stage={state.stage}
				hidden={!state.message}>
				{state.message}
			</div>
			{onCancel && (
				<Button variant="outline-cancel" data-testid="progress-tracker-modal-cancel-btn" onClick={onCancel}>
					<Icon name="ban" style="base" className="mr-1" />
					{i18n.t('sidebar.results.reference.cancel')}
				</Button>
			)}
		</div>
	</Dialog>
);
