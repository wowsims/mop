import type { MeleeCritCapInfo } from '@domain/player';
import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { Tooltip } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type CSSProperties, useId } from 'react';

import { TooltipRow } from './TooltipRow';
import { critCapClass } from './utils/stat_display';

export interface CritCapRowProps {
	info: MeleeCritCapInfo;
	text: string;
}

// A spacer sized like the value it replaces, its border hidden by zeroing Bootstrap's opacity var.
//
// This is the one place a ported component writes a `--bs-*` name, and it has to until the parity
// gate retires. The class list is what `panes-parity.mjs` compares, so `border-body border-brand`
// cannot be dropped; those utilities set `border-color` with `!important`, so an inline
// `borderColor: transparent` loses to them and the border paints solid orange — measured, not
// assumed. Zeroing the variable the utility itself reads is the only lever left.
const SPACER_STYLE = { '--bs-border-opacity': '0' } as CSSProperties;

export const CritCapRow = ({ info, text }: CritCapRowProps) => {
	const id = useId();
	return (
		<tr className="character-stats-table-row">
			<td className="character-stats-table-label">{i18n.t('sidebar.character_stats.melee_crit_cap')}</td>
			<td className="character-stats-table-value">
				<div className="stat-value-link-container">
					<Button variant="unstyled" className={clsx('stat-value-link', critCapClass(info.playerCritCapDelta))} data-tooltip-id={id}>
						{`${text} `}
					</Button>
				</div>
				<span className="px-2 border-start border-end border-body border-brand" style={SPACER_STYLE} />
				<Tooltip
					id={id}
					content={
						<div>
							<TooltipRow label={i18n.t('sidebar.character_stats.attack_table.glancing')} value={`${info.glancing.toFixed(2)}%`} />
							<TooltipRow label={i18n.t('sidebar.character_stats.attack_table.suppression')} value={`${info.suppression.toFixed(2)}%`} />
							<TooltipRow label={i18n.t('sidebar.character_stats.attack_table.to_hit_cap')} value={`${info.remainingMeleeHitCap.toFixed(2)}%`} />
							<TooltipRow label={i18n.t('sidebar.character_stats.attack_table.to_exp_cap')} value={`${info.remainingExpertiseCap.toFixed(2)}%`} />
							{info.specSpecificOffset !== 0 && (
								<TooltipRow
									label={i18n.t('sidebar.character_stats.attack_table.spec_offsets')}
									value={`${info.specSpecificOffset.toFixed(2)}%`}
								/>
							)}
							<TooltipRow label={i18n.t('sidebar.character_stats.attack_table.final_crit_cap')} value={`${info.baseCritCap.toFixed(2)}%`} />
							<hr />
							<TooltipRow
								label={i18n.t('sidebar.character_stats.attack_table.can_raise_by')}
								value={`${(info.remainingExpertiseCap + info.remainingMeleeHitCap).toFixed(2)}%`}
							/>
						</div>
					}
				/>
			</td>
		</tr>
	);
};
