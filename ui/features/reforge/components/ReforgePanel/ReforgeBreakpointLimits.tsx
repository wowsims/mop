import { breakpointValueToDisplayPercentage } from '@features/reforge/model/utils';
import { StatCapType } from '@generated/proto/api';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import type { StatCap } from '@sim/proto/stats';
import type { ReforgeSettings } from '@sim/settings/reforge_settings';
import { Button } from '@ui-kit/Button';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { Icon } from '@ui-kit/Icon';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useId } from 'react';

import { INCLUDED_STATS } from './utils';

export interface ReforgeBreakpointLimitsProps {
	settings: ReforgeSettings;
	softCapsConfig: StatCap[];
	player: Player<any>;
	useSoftCapBreakpoints: boolean;
}

/** Caps the highest breakpoint the optimizer will chase, one select per soft-capped stat. */
export const ReforgeBreakpointLimits = ({ settings, softCapsConfig, player, useSoftCapBreakpoints }: ReforgeBreakpointLimitsProps) => {
	const tooltipId = useId();

	if (!useSoftCapBreakpoints) return null;

	return (
		<table className="reforge-optimizer-stat-cap-table mb-2">
			<thead>
				<tr>
					<th colSpan={3} className="pb-3">
						<div className="d-flex">
							<h6 className="content-block-title mb-0 me-1">{i18n.t('sidebar.buttons.suggest_reforges.breakpoint_limit')}</h6>
							<Button variant="unstyled" className="d-inline" {...tooltipAnchorProps(tooltipId)}>
								<Icon name="circle-question" style="regular" />
							</Button>
							<Tooltip id={tooltipId} content={i18n.t('sidebar.buttons.suggest_reforges.breakpoint_limit_tooltip')} />
						</div>
					</th>
				</tr>
			</thead>
			<tbody>
				{softCapsConfig
					.filter(
						config => (config.capType === StatCapType.TypeThreshold || config.capType === StatCapType.TypeSoftCap) && config.breakpoints.length > 0,
					)
					.map(({ breakpoints, unitStat }) => {
						if (!unitStat.hasRootStat() || !INCLUDED_STATS.includes(unitStat.getRootStat())) return null;
						const statName = unitStat.getShortName(player.getClass());
						return (
							<tr key={unitStat.getKey()} className="reforge-optimizer-stat-cap-item">
								<td>
									<div className="reforge-optimizer-stat-cap-item-label">{statName}</div>
								</td>
								<td colSpan={2}>
									<EnumPicker
										modObject={player}
										config={{
											id: `reforge-optimizer-${statName}-presets`,
											extraClassNames: ['mb-0'],
											label: '',
											values: [
												{ name: i18n.t('sidebar.buttons.suggest_reforges.no_limit_set'), value: 0 },
												...breakpoints.map(breakpoint => ({
													name: `${breakpointValueToDisplayPercentage(player, breakpoint, unitStat)}%`,
													value: breakpoint,
												})),
											].sort((a, b) => a.value - b.value),
											storeField: 'reforge:useSoftCapBreakpoints',
											getValue: () => {
												const limit = settings.breakpointLimits.getUnitStat(unitStat);
												return breakpoints.some(breakpoint => breakpoint == limit) ? limit : 0;
											},
											setValue: (_player, newValue) =>
												settings.setBreakpointLimits(settings.breakpointLimits.withUnitStat(unitStat, newValue)),
										}}
									/>
								</td>
							</tr>
						);
					})}
			</tbody>
		</table>
	);
};
