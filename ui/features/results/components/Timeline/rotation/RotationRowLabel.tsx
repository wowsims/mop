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
	header?: boolean;
	measuring?: boolean;
}

/**
 * The sticky first column of every row. Its width, padding and gap are shared with `.rotation-corner`
 * — the ruler only lines up with the tracks while the two stay identical.
 */
export const RotationRowLabel = ({ text, icon, onHide, className, header, measuring }: RotationRowLabelProps) => (
	<div
		className={clsx(
			measuring ? 'flex box-border shrink-0 grow-0 basis-auto w-max items-center gap-1 pr-2' : 'ui-timeline-label-col sticky left-0 z-3',
			'rotation-row-label overflow-hidden bg-background whitespace-nowrap font-bold',
			header ? 'text-[14px] uppercase' : 'text-[13px]',
			className,
		)}>
		{onHide && (
			<Button
				iconOnly
				aria-label={`Hide ${text}`}
				title="Hide row"
				className="rotation-row-hide fas fa-eye-slash flex-none p-0 text-white hover:text-link-danger"
				onClick={onHide}
			/>
		)}
		{icon}
		<span className="rotation-label-text max-lg:hidden overflow-hidden text-ellipsis">{text}</span>
	</div>
);
