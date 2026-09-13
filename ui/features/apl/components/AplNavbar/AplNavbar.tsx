import { RotationTypePicker } from '@features/apl/components/RotationTypePicker';
import { APL_PANES } from '@features/apl/model/apl_panes';
import i18n from '@i18n/config';
import { useStickyToolbar } from '@ui-kit/hooks/useStickyToolbar';
import { TabNav } from '@ui-kit/TabNav';
import clsx from 'clsx';

/** The APL pane's header: the rotation-type picker, then the sub-tab strip, in one sticky row. */
export const AplNavbar = () => {
	const { ref, stuck, className } = useStickyToolbar<HTMLDivElement>();

	return (
		<div
			ref={ref}
			className={clsx('grow shrink-0 basis-full gap-1 sticky-toolbar-root', className, stuck && 'stuck')}
			data-testid="apl-rotation-navbar"
			data-stuck={stuck ? '' : undefined}>
			<div className="rotation-type-container">
				<RotationTypePicker />
			</div>
			<TabNav
				bordered={false}
				wrap={false}
				className="ml-auto overflow-auto shrink"
				tabs={APL_PANES.map(pane => ({ id: pane.id, label: i18n.t(pane.labelKey) }))}
			/>
		</div>
	);
};
