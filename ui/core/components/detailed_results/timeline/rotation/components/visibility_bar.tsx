export type VisibilityBarProps = {
	toggleRef: JSX.HTMLElementProps<'button'>['ref'];
	summaryRef: JSX.HTMLElementProps<'span'>['ref'];
	previewRef: JSX.HTMLElementProps<'span'>['ref'];
	showAllRef: JSX.HTMLElementProps<'button'>['ref'];
	panelRef: JSX.HTMLElementProps<'div'>['ref'];
	groupsRef: JSX.HTMLElementProps<'div'>['ref'];
};

export const VisibilityChip = ({ rowKey, label }: { rowKey: string; label: string }) =>
	(
		<button type="button" className="rotation-chip" tabIndex={-1} dataset={{ rowKey }} attributes={{ role: 'switch', 'aria-checked': 'true' }}>
			{label}
		</button>
	) as HTMLButtonElement;

export const VisibilityGroup = ({ title, chips }: { title: string; chips: Array<HTMLButtonElement> }) => {
	if (chips.length) chips[0].tabIndex = 0;
	return (
		<div className="rotation-chip-group">
			<div className="rotation-chip-group-title">{title}</div>
			<div className="rotation-chip-group-chips">{chips}</div>
		</div>
	) as HTMLDivElement;
};

export const VisibilityBar = ({ toggleRef, summaryRef, previewRef, showAllRef, panelRef, groupsRef }: VisibilityBarProps) =>
	(
		<div className="rotation-visibility" dataset={{ expanded: 'false' }}>
			<div className="rotation-visibility-bar">
				<button ref={toggleRef} type="button" className="rotation-visibility-toggle" attributes={{ 'aria-expanded': 'false' }}>
					<i className="fas fa-eye" />
					<span ref={summaryRef} className="rotation-visibility-summary" />
					<span ref={previewRef} className="rotation-visibility-preview" />
				</button>
				<button ref={showAllRef} type="button" className="rotation-visibility-show-all">
					Show all
				</button>
			</div>
			<div ref={panelRef} className="rotation-visibility-panel">
				<div className="rotation-visibility-panel-inner">
					<div ref={groupsRef} className="rotation-visibility-groups" />
				</div>
			</div>
		</div>
	) as HTMLDivElement;
