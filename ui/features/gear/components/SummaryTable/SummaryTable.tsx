import { Button } from '@ui-kit/Button';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { Icon } from '@ui-kit/Icon';
import type { ReactNode } from 'react';

export interface SummaryTableProps {
	title: string;
	modifier: string;
	empty: boolean;
	reset: { label: string; onReset: () => void };
	children?: ReactNode;
}

export const SummaryTable = ({ title, modifier, empty, reset, children }: SummaryTableProps) =>
	empty ? null : (
		<div className="max-md:w-full" data-testid="summary-table-root" data-summary={modifier}>
			<ContentBlock
				config={{ header: { title }, bodyClassName: 'gap-1' }}
				headerChildren={
					<Button variant="link-danger" size="sm" className="ml-auto shrink-0" data-testid="summary-table-reset-button" onClick={reset.onReset}>
						<Icon name="times" className="mr-1" />
						{reset.label}
					</Button>
				}>
				{children}
			</ContentBlock>
		</div>
	);
