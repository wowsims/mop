import './SummaryTable.scss';

import { Button } from '@ui-kit/Button';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { Icon } from '@ui-kit/Icon';
import type { ClassValue } from 'clsx';
import type { ReactNode } from 'react';

export interface SummaryTableProps {
	title: string;
	className: ClassValue;
	headerClassName?: ClassValue;
	empty: boolean;
	reset: { label: string; onReset: () => void };
	children?: ReactNode;
}

export const SummaryTable = ({ title, className, headerClassName, empty, reset, children }: SummaryTableProps) =>
	empty ? null : (
		<div className="summary-table-root">
			<ContentBlock
				className={['summary-table-container', className]}
				config={{ header: { title, className: headerClassName } }}
				headerChildren={
					<Button variant="link" size="sm" className="btn-reset summary-table-reset-button" onClick={reset.onReset}>
						<Icon name="times" className="me-1" />
						{reset.label}
					</Button>
				}>
				{children}
			</ContentBlock>
		</div>
	);
