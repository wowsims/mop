import i18n from '@i18n/config';
import type { MeleeCritCapInfo } from '@sim/player/player';
import { Button } from '@ui-kit/Button';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useId } from 'react';

import { TooltipRow } from './TooltipRow';
import { critCapClass } from './utils/stat_display';

export interface CritCapRowProps {
	info: MeleeCritCapInfo;
	text: string;
}

export const CritCapRow = ({ info, text }: CritCapRowProps) => {
	const id = useId();
	return (
		<tr data-testid="character-stats-table-row" className="ui-character-stats-row">
			<td className="ui-character-stats-label">{i18n.t('sidebar.character_stats.melee_crit_cap')}</td>
			<td className="ui-character-stats-value">
				<div className="ui-stat-value-link-container">
					<Button variant="unstyled" data-testid="stat-value-link" className={critCapClass(info.playerCritCapDelta)} {...tooltipAnchorProps(id)}>
						{`${text} `}
					</Button>
				</div>
				<span className="border-x border-transparent px-2" />
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
