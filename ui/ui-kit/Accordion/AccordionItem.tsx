import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import { Icon } from '@ui-kit/Icon';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface AccordionItemProps {
	value: string;
	title: ReactNode;
	panelClassName?: ClassValue;
	testId?: string;
	children?: ReactNode;
}

export const AccordionItem = ({ value, title, panelClassName, testId, children }: AccordionItemProps) => (
	<BaseAccordion.Item className="ui-accordion-item" value={value} data-testid={testId}>
		<BaseAccordion.Header className="ui-accordion-header" render={<h6 />}>
			<BaseAccordion.Trigger className="ui-accordion-trigger" data-testid={testId ? `${testId}-trigger` : undefined}>
				{title}
				<Icon name="chevron-down" className="ui-accordion-chevron" />
			</BaseAccordion.Trigger>
		</BaseAccordion.Header>
		<BaseAccordion.Panel>
			<div className={clsx('ui-accordion-panel-body', panelClassName)}>{children}</div>
		</BaseAccordion.Panel>
	</BaseAccordion.Item>
);
