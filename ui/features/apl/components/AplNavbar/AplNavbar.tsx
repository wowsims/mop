import { RotationTypePicker } from '@features/apl/components/RotationTypePicker';
import type { AplPaneId } from '@features/apl/model/apl_panes';
import { APL_PANES } from '@features/apl/model/apl_panes';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { useStickyToolbar } from '@ui-kit/hooks/useStickyToolbar';
import { nextTabByKey } from '@ui-kit/tab_keys';
import clsx from 'clsx';
import type { KeyboardEvent } from 'react';

export interface AplNavbarProps {
	activeId: AplPaneId;
	onSelect: (id: AplPaneId) => void;
}

/** The APL pane's header: the rotation-type picker, then the sub-tab strip, in one sticky row. */
export const AplNavbar = ({ activeId, onSelect }: AplNavbarProps) => {
	const host = useSimHost();
	const { ref, stuck } = useStickyToolbar<HTMLDivElement>(host.simHeader.rootElem);

	const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
		// The *focused* tab, not the selected one: the roving tabindex makes them the same in ordinary use, but focus can be moved without selecting.
		const focused = (event.target as HTMLElement).closest('[role=tab]')?.getAttribute('aria-controls');
		const next = nextTabByKey(APL_PANES, focused ?? activeId, event.key);
		if (!next) return;
		event.preventDefault();
		event.stopPropagation();
		onSelect(next);
		event.currentTarget.querySelector<HTMLButtonElement>(`[aria-controls="${next}"]`)?.focus({ preventScroll: true });
	};

	return (
		<div ref={ref} className={clsx('apl-rotation-navbar sticky-toolbar-root', stuck && 'stuck')}>
			<div className="rotation-type-container">
				<RotationTypePicker />
			</div>
			<ul className="nav nav-tabs" role="tablist" onKeyDown={onKeyDown}>
				{APL_PANES.map(pane => {
					const isActive = pane.id === activeId;
					return (
						<li key={pane.id} className="nav-item" role="presentation">
							<button
								type="button"
								className={clsx('nav-link', isActive && 'active')}
								role="tab"
								aria-controls={pane.id}
								aria-selected={isActive}
								tabIndex={isActive ? undefined : -1}
								onClick={() => onSelect(pane.id)}>
								{i18n.t(pane.labelKey)}
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
};
