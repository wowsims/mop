import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import type { ReactNode } from 'react';

export interface AccordionProps {
	value: string[];
	onValueChange: (value: string[]) => void;
	children?: ReactNode;
}

export const Accordion = ({ value, onValueChange, children }: AccordionProps) => (
	<BaseAccordion.Root className="ui-accordion" multiple value={value} onValueChange={onValueChange}>
		{children}
	</BaseAccordion.Root>
);
