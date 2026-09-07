import './SummaryTable.scss';

import { Button } from '@ui-kit/Button';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { Icon } from '@ui-kit/Icon';
import type { ReactNode } from 'react';

export interface SummaryTableProps {
	title: string;
	cssClass: string;
	headerCssClass?: string;
	empty: boolean;
	reset: { label: string; onReset: () => void };
	children?: ReactNode;
}

export const SummaryTable = ({ title, cssClass, headerCssClass, empty, reset, children }: SummaryTableProps) => (
	<div className={empty ? 'summary-table-root hide' : 'summary-table-root'}>
		<ContentBlock
			cssClass="summary-table-container"
			config={{ header: { title, extraCssClasses: headerCssClass ? [headerCssClass] : undefined }, extraCssClasses: [cssClass] }}
			headerChildren={
				!empty && (
					<Button variant="link" size="sm" className="btn-reset summary-table-reset-button" onClick={reset.onReset}>
						<Icon name="times" className="me-1" />
						{reset.label}
					</Button>
				)
			}>
			{!empty && children}
		</ContentBlock>
	</div>
);
