import { Tabs } from '@base-ui/react/tabs';
import { TabBadge } from '@ui-kit/TabBadge';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface TabNavTab {
	id: string;
	label: ReactNode;
	className?: string;
	badge?: string;
	tabId?: string;
	ariaControls?: string;
	dataLabel?: string;
	buttonClassName?: string;
}

export interface TabNavProps {
	tabs: Array<TabNavTab>;
	className?: string;
	variant?: 'nav-tabs' | 'sim';
	tabItemClassName?: string;
	bordered?: boolean;
	wrap?: boolean;
	testId?: string;
}

export const TabNav = ({ tabs, className, variant = 'nav-tabs', tabItemClassName, bordered = true, wrap = true, testId }: TabNavProps) => {
	if (variant === 'sim') {
		return (
			<Tabs.List className={clsx('ui-tabs-sim font-bold', className)} data-testid={testId} activateOnFocus>
				{tabs.map(tab => (
					<Tabs.Tab key={tab.id} value={tab.id} className={clsx(tab.id, 'ui-tab', tab.buttonClassName)} data-testid={tab.id}>
						{tab.label}
						<TabBadge label={tab.badge} />
					</Tabs.Tab>
				))}
			</Tabs.List>
		);
	}

	return (
		<Tabs.List
			className={clsx('ui-tabs', wrap ? 'flex-wrap' : 'flex-nowrap', bordered ? 'border-b border-b-border' : 'border-b-0', className)}
			data-testid={testId}
			activateOnFocus
			render={<ul />}>
			{tabs.map(tab => (
				<li key={tab.id} className={clsx('flex items-center', tabItemClassName, tab.className)} role="presentation">
					<Tabs.Tab
						value={tab.id}
						id={tab.tabId}
						aria-controls={tab.ariaControls ?? tab.id}
						data-label={tab.dataLabel}
						className={clsx('ui-tab ui-tab-nav', tab.buttonClassName)}>
						{tab.label}
						<TabBadge label={tab.badge} />
					</Tabs.Tab>
				</li>
			))}
		</Tabs.List>
	);
};
