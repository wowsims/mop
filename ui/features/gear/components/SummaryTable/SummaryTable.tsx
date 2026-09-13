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
		<div className="summary-table-root max-md:w-full">
			<ContentBlock
				className={['summary-table-container', className]}
				config={{ header: { title, className: headerClassName }, bodyClassName: 'gap-1' }}
				headerChildren={
					<Button variant="link-danger" size="sm" className="summary-table-reset-button ml-auto shrink-0" onClick={reset.onReset}>
						<Icon name="times" className="mr-1" />
						{reset.label}
					</Button>
				}>
				{children}
			</ContentBlock>
		</div>
	);
