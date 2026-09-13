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

const TAB_CLASS =
	"flex items-center m-0 border-0 py-(--tab-padding-y) px-(--tab-padding-x) bg-transparent text-(--tab-color) [font-family:inherit] text-[length:var(--tab-font-size)] font-bold whitespace-nowrap no-underline cursor-pointer [transition:var(--tab-transition)] hover:text-(--tab-color-hover) focus-visible:outline-0 focus-visible:focus-ring data-[active]:relative data-[active]:text-(--tab-color-active) data-[active]:after:content-[''] data-[active]:after:absolute data-[active]:after:inset-x-0 data-[active]:after:bottom-0 data-[active]:after:h-[2px] data-[active]:after:bg-(--tab-color-active)";

const NAV_TABS_TAB_CLASS = clsx(TAB_CLASS, 'h-full border-current focus:text-(--tab-color-hover)');

export const TabNav = ({ tabs, className, variant = 'nav-tabs', tabItemClassName, bordered = true, wrap = true, testId }: TabNavProps) => {
	if (variant === 'sim') {
		return (
			<Tabs.List className={clsx('sim-tabs m-0 flex list-none flex-nowrap items-end p-0', className)} data-testid={testId} activateOnFocus>
				{tabs.map(tab => (
					<Tabs.Tab key={tab.id} value={tab.id} className={clsx('sim-tab-link', tab.id, TAB_CLASS, tab.buttonClassName)} data-testid={tab.id}>
						{tab.label}
						<TabBadge label={tab.badge} />
					</Tabs.Tab>
				))}
			</Tabs.List>
		);
	}

	return (
		<Tabs.List
			className={clsx(
				'nav nav-tabs flex mb-0 pl-0 list-none',
				wrap ? 'flex-wrap' : 'flex-nowrap',
				bordered ? 'border-b border-b-border' : 'border-b-0',
				className,
			)}
			data-testid={testId}
			activateOnFocus
			render={<ul />}>
			{tabs.map(tab => (
				<li key={tab.id} className={clsx('nav-item flex items-center', tabItemClassName, tab.className)} role="presentation">
					<Tabs.Tab
						value={tab.id}
						id={tab.tabId}
						aria-controls={tab.ariaControls ?? tab.id}
						data-label={tab.dataLabel}
						className={state => clsx('nav-link', NAV_TABS_TAB_CLASS, tab.buttonClassName, state.active && 'active')}>
						{tab.label}
						<TabBadge label={tab.badge} />
					</Tabs.Tab>
				</li>
			))}
		</Tabs.List>
	);
};
