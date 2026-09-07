import { formatToCompactNumber, formatToPercent } from '@domain/format';
import { spellSchoolNames } from '@domain/proto_utils/names';
import type { SpellSchool } from '@generated/proto/common';
import clsx from 'clsx';
import type { CSSProperties } from 'react';

export interface MetricsTotalBarProps {
	percentage: number | undefined | null;
	max: number | null;
	total: number;
	value: number;
	/** A darkened bar drawn over the main one — shielding, on the healing table. */
	overlayValue?: number;
	spellSchool?: SpellSchool | undefined | null;
	classColor?: string | undefined | null;
}

const fill = (value: number, max: number | null): CSSProperties => ({ '--percentage': formatToPercent((value / (max ?? 1)) * 100) }) as CSSProperties;

export const MetricsTotalBar = ({ percentage, max, total, value, overlayValue, spellSchool, classColor }: MetricsTotalBarProps) => {
	const spellSchoolString = typeof spellSchool === 'number' ? spellSchoolNames.get(spellSchool) : undefined;
	return (
		<div className="metrics-total position-relative d-flex justify-content-between w-100">
			<div className="metrics-total-percentage">{formatToPercent(percentage || 0)}</div>
			<div className="metrics-total-bar ms-1 me-1">
				<div
					className={clsx(
						'metrics-total-bar-fill',
						spellSchoolString && `bg-spell-school-${spellSchoolString.toLowerCase()}`,
						classColor && `bg-${classColor.toLowerCase()}`,
					)}
					style={fill(value, max)}
				/>
				{!!overlayValue && <div className="metrics-total-bar-fill bg-black bg-opacity-25" style={fill(overlayValue, max)} />}
			</div>
			<div className="metrics-total-amount">{formatToCompactNumber(total)}</div>
		</div>
	);
};
