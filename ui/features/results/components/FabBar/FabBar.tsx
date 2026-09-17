import { Drawer } from '@ui-kit/Drawer';
import { useStickyViewportBottom } from '@ui-kit/hooks/useStickyViewportBottom';
import { Toolbar, ToolbarButton } from '@ui-kit/Toolbar';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useState } from 'react';

export interface FabBarClearAction {
	testId: string;
	className?: string;
	icon: ReactNode;
	label: string;
	hidden: boolean;
	onClick: () => void;
}

export interface FabBarProps {
	/** Builds the bar's test ids: `<prefix>-floating-action-bar-root`, `<prefix>-fab-toggle` and the rest. */
	testIdPrefix: string;
	rootClassName: string;
	sheetClassName: string;
	/** Slotted mid-list, so the bar's own utilities keep the order they are written in today. */
	toolbarClassName?: string;
	toggleLabel: string;
	icon: ReactNode;
	summary: string;
	preview: string;
	clear: FabBarClearAction;
	/** The bar's right-hand controls — export, back to top, the debug toggle. */
	controls?: ReactNode;
	/** The drawer's contents, wrapper and all. */
	children: ReactNode;
}

export const FabBar = ({
	testIdPrefix,
	rootClassName,
	sheetClassName,
	toolbarClassName,
	toggleLabel,
	icon,
	summary,
	preview,
	clear,
	controls,
	children,
}: FabBarProps) => {
	const [expanded, setExpanded] = useState(false);
	const { ref: rootRef, stuck } = useStickyViewportBottom<HTMLDivElement>();

	return (
		<div
			ref={rootRef}
			data-testid={`${testIdPrefix}-floating-action-bar-root`}
			className={clsx('group ui-fab-root', rootClassName)}
			data-stuck={stuck ? '' : undefined}>
			<Toolbar
				testId={`${testIdPrefix}-fab-actions`}
				className={clsx('relative min-w-0 flex-1 flex-nowrap items-center', toolbarClassName, 'overflow-x-auto group-data-stuck:bg-background')}>
				<Drawer
					open={expanded}
					onOpenChange={setExpanded}
					modal={false}
					ignoreOutsidePress={event => !!rootRef.current?.contains(event.target as Node)}
					className={sheetClassName}
					testId={`${testIdPrefix}-fab-panel-inner`}
					trigger={
						<ToolbarButton testId={`${testIdPrefix}-fab-toggle`} className="ui-fab-toggle flex items-center gap-2" aria-label={toggleLabel}>
							{icon}
							<span data-testid={`${testIdPrefix}-fab-summary`}>{summary}</span>
							<span data-testid={`${testIdPrefix}-fab-preview`} className="truncate opacity-75">
								{preview}
							</span>
						</ToolbarButton>
					}>
					{children}
				</Drawer>
				<ToolbarButton
					variant="link-danger"
					size="sm"
					testId={clear.testId}
					className={clsx(clear.className, clear.hidden && 'hidden')}
					hidden={clear.hidden}
					onClick={clear.onClick}>
					{clear.icon}
					{clear.label}
				</ToolbarButton>
				{controls}
			</Toolbar>
		</div>
	);
};
