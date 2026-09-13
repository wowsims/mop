import clsx from 'clsx';
import type { ElementType, ReactNode } from 'react';

export type TabPanelColumnsGap = 'default' | 'apl';

export interface TabPanelColumnsRootProps {
	as?: ElementType;
	gap?: TabPanelColumnsGap;
	fullWidth?: boolean;
	externalDisplay?: boolean;
	className?: string;
	children?: ReactNode;
	[key: string]: unknown;
}

const ROOT_GAP_CLASSES: Record<TabPanelColumnsGap, string> = {
	default: 'gap-page max-lg:gap-section',
	apl: 'gap-y-6 gap-x-page',
};

const Root = ({ as: Component = 'div', gap = 'default', fullWidth, externalDisplay, className, children, ...rest }: TabPanelColumnsRootProps) => (
	<Component className={clsx(!externalDisplay && 'flex', 'flex-wrap max-xl:flex-col', ROOT_GAP_CLASSES[gap], fullWidth && 'w-full', className)} {...rest}>
		{children}
	</Component>
);

export type TabPanelColumnsLeftVariant = 'default' | 'auto-columns' | 'settings-columns' | 'stacked';

export interface TabPanelColumnsLeftProps {
	className?: string;
	variant?: TabPanelColumnsLeftVariant;
	children?: ReactNode;
}

const LEFT_VARIANT_CLASSES: Record<TabPanelColumnsLeftVariant, string> = {
	default: 'grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] max-lg:flex max-lg:flex-col',
	'auto-columns': 'grid grid-cols-[auto] max-lg:flex max-lg:flex-col',
	'settings-columns': 'grid grid-cols-[2fr_2fr_3fr] max-lg:flex max-lg:flex-col',
	stacked: 'flex flex-col grid-cols-[repeat(auto-fit,minmax(220px,1fr))]',
};

const Left = ({ className, variant = 'default', children }: TabPanelColumnsLeftProps) => (
	<div className={clsx('tab-panel-left w-full flex-[4] gap-section', LEFT_VARIANT_CLASSES[variant], className)}>{children}</div>
);

export interface TabPanelColumnsRightProps {
	className?: string;
	children?: ReactNode;
}

const Right = ({ className, children }: TabPanelColumnsRightProps) => (
	<div className={clsx('tab-panel-right w-full min-w-[200px] flex flex-col gap-section flex-[1.25]', className)}>{children}</div>
);

export interface TabPanelColumnsColProps {
	className?: string;
	externalGap?: boolean;
	children?: ReactNode;
}

const Col = ({ className, externalGap, children }: TabPanelColumnsColProps) => (
	<div className={clsx('tab-panel-col flex flex-col', !externalGap && 'gap-section', className)}>{children}</div>
);

export const TabPanelColumns = { Root, Left, Right, Col };
