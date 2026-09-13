import { Button } from '@ui-kit/Button';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface RotationRowLabelProps {
	text: string;
	icon?: ReactNode;
	/** A row that can be hidden shows the eye toggle; a header and the width measurer pass nothing. */
	onHide?: () => void;
	className?: ClassValue;
}

/**
 * The sticky first column of every row. Its width, padding and gap are shared with `.rotation-corner`
 * — the ruler only lines up with the tracks while the two stay identical.
 */
export const RotationRowLabel = ({ text, icon, onHide, className }: RotationRowLabelProps) => (
	<div className={clsx('rotation-row-label', className)}>
		{onHide && <Button iconOnly aria-label={`Hide ${text}`} title="Hide row" className="rotation-row-hide fas fa-eye-slash p-0" onClick={onHide} />}
		{icon}
		<span className="rotation-label-text overflow-hidden text-ellipsis">{text}</span>
	</div>
);
