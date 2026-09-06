import './ProgressTrackerDialog.scss';

import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { Dialog } from '@ui-kit/Dialog';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import type { ReactNode, Ref } from 'react';

import { ElapsedTime } from './ElapsedTime';
import { ProgressTrackerBar } from './ProgressTrackerBar';
import type { ProgressTrackerHandle, ProgressTrackerState } from './types';

export interface ProgressTrackerDialogProps {
	open: boolean;
	title: string;
	state: ProgressTrackerState;
	cssClass?: string;
	warning?: ReactNode;
	hasProgressBar?: boolean;
	onCancel?: () => void;
	container?: HTMLElement | null;
	ref?: Ref<ProgressTrackerHandle>;
}

export const ProgressTrackerDialog = ({ open, title, state, cssClass, warning, hasProgressBar, onCancel, container, ref }: ProgressTrackerDialogProps) => (
	<Dialog
		open={open}
		onOpenChange={() => {}}
		cssClass={clsx('progress-tracker-dialog', cssClass)}
		container={container}
		size="md"
		title={title}
		preventClose
		keepMounted>
		<div className="progress-tracker-modal-content" data-stage={state.stage}>
			{warning && <div className="progress-tracker-modal-warning">{warning}</div>}
			{hasProgressBar && <ProgressTrackerBar running={open} ref={ref} />}
			<div className="progress-tracker-modal-time-display">
				<strong>{i18n.t('common.elapsed_time')}:</strong> <ElapsedTime running={open} />
			</div>
			<div className={clsx('progress-tracker-modal-message', !state.message && 'd-none')} data-stage={state.stage}>
				{state.message}
			</div>
			{onCancel && (
				<Button variant="outline-cancel" className="progress-tracker-modal-cancel-btn" onClick={onCancel}>
					<Icon name="ban" style="base" className="me-1" />
					{i18n.t('sidebar.results.reference.cancel')}
				</Button>
			)}
		</div>
	</Dialog>
);
