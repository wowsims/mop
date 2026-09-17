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
		<div className="relative flex w-full min-w-[calc(7ch+7ch+50px)] justify-between">
			<div className="w-[7ch] shrink-0">{formatToPercent(percentage || 0)}</div>
			<div className="absolute right-[7ch] left-[7ch] mr-1 ml-1 h-full shrink grow bg-white/5">
				<div data-testid="metrics-total-bar-fill" className={clsx('absolute top-0 left-0 h-full w-(--percentage)', fillBg)} style={fill(value, max)} />
				{!!overlayValue && (
					<div
						data-testid="metrics-total-bar-fill"
						className="absolute top-0 left-0 h-full w-(--percentage) bg-black/25"
						style={fill(overlayValue, max)}
					/>
				)}
			</div>
			<div className="w-[7ch]">{formatToCompactNumber(total)}</div>
		</div>
	);
};
