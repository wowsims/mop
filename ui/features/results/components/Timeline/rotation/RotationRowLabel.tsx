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
			measuring ? 'box-border flex w-max shrink-0 grow-0 basis-auto items-center gap-1 pr-2' : 'ui-timeline-label-col sticky left-0 z-3',
			'overflow-hidden bg-background font-bold whitespace-nowrap',
			header ? 'text-sm uppercase' : 'text-[13px]',
			className,
		)}>
		{onHide && (
			<Button
				iconOnly
				aria-label={`Hide ${text}`}
				title="Hide row"
				data-testid="rotation-row-hide"
				className="fas fa-eye-slash flex-none p-0 text-white hover:text-link-danger"
				onClick={onHide}
			/>
		)}
		{icon}
		<span data-testid="rotation-label-text" className="overflow-hidden text-ellipsis max-lg:hidden">
			{text}
		</span>
	</div>
);
