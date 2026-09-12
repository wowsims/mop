import './MetricsTotalBar.scss';

import type { SpellSchool } from '@generated/proto/common';
import { spellSchoolNames } from '@sim/proto/names';
import { formatToCompactNumber, formatToPercent } from '@sim/utils/format';
import { cssVars } from '@ui-kit/utils/css';
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

const fill = (value: number, max: number | null): CSSProperties => cssVars({ '--percentage': formatToPercent((value / (max ?? 1)) * 100) });

export const MetricsTotalBar = ({ percentage, max, total, value, overlayValue, spellSchool, classColor }: MetricsTotalBarProps) => {
	const spellSchoolString = typeof spellSchool === 'number' ? spellSchoolNames.get(spellSchool) : undefined;
	return (
		<div className="metrics-total relative flex justify-between w-full">
			<div className="metrics-total-percentage shrink-0">{formatToPercent(percentage || 0)}</div>
			<div className="metrics-total-bar ml-1 mr-1">
				<div
					className={clsx(
						'metrics-total-bar-fill',
						spellSchoolString && `bg-spell-school-${spellSchoolString.toLowerCase()}`,
						classColor && `bg-class-${classColor.toLowerCase()}`,
					)}
					style={fill(value, max)}
				/>
				{!!overlayValue && <div className="metrics-total-bar-fill bg-black/25" style={fill(overlayValue, max)} />}
			</div>
			<div className="metrics-total-amount">{formatToCompactNumber(total)}</div>
		</div>
	);
};
