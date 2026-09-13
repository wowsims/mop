import type { SpellSchool } from '@generated/proto/common';
import { spellSchoolNames } from '@sim/proto/names';
import { formatToCompactNumber, formatToPercent } from '@sim/utils/format';
import { CLASS_BG, SPELL_SCHOOL_BG } from '@ui-kit/utils/colors';
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
	const fillBg =
		(spellSchoolString && SPELL_SCHOOL_BG[spellSchoolString.toLowerCase()]) || (classColor && CLASS_BG[classColor.toLowerCase()]) || 'bg-current';
	return (
		<div className="metrics-total relative flex justify-between w-full min-w-[calc(7ch+7ch+50px)]">
			<div className="metrics-total-percentage shrink-0 w-[7ch]">{formatToPercent(percentage || 0)}</div>
			<div className="metrics-total-bar ml-1 mr-1 absolute left-[7ch] right-[7ch] h-full grow shrink bg-white-5">
				<div className={clsx('metrics-total-bar-fill absolute top-0 left-0 h-full w-(--percentage)', fillBg)} style={fill(value, max)} />
				{!!overlayValue && (
					<div className="metrics-total-bar-fill absolute top-0 left-0 h-full w-(--percentage) bg-black/25" style={fill(overlayValue, max)} />
				)}
			</div>
			<div className="metrics-total-amount w-[7ch]">{formatToCompactNumber(total)}</div>
		</div>
	);
};
