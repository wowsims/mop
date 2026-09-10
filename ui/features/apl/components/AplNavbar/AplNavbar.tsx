import { Tabs } from '@base-ui/react/tabs';
import { RotationTypePicker } from '@features/apl/components/RotationTypePicker';
import { APL_PANES } from '@features/apl/model/apl_panes';
import i18n from '@i18n/config';
import { useStickyToolbar } from '@ui-kit/hooks/useStickyToolbar';
import clsx from 'clsx';

/** The APL pane's header: the rotation-type picker, then the sub-tab strip, in one sticky row. */
export const AplNavbar = () => {
	const { ref, stuck } = useStickyToolbar<HTMLDivElement>();

	return (
		<div ref={ref} className={clsx('apl-rotation-navbar sticky-toolbar-root', stuck && 'stuck')}>
			<div className="rotation-type-container">
				<RotationTypePicker />
			</div>
			<Tabs.List className="nav nav-tabs" activateOnFocus render={<ul />}>
				{APL_PANES.map(pane => (
					<li key={pane.id} className="nav-item" role="presentation">
						{/* Base UI's own `aria-controls` would point at nothing: `Tabs.Panel` registers a generated id rather than the one it renders. */}
						<Tabs.Tab value={pane.id} aria-controls={pane.id} className={state => clsx('nav-link', state.active && 'active')}>
							{i18n.t(pane.labelKey)}
						</Tabs.Tab>
					</li>
				))}
			</Tabs.List>
		</div>
	);
};
