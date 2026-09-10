import { breakpointValueToDisplayPercentage } from '@features/reforge/model/utils';
import { StatCapType } from '@generated/proto/api';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import { statCapTypeNames } from '@sim/proto/names';
import type { StatCap } from '@sim/proto/stats';
import type { StatTooltipContent } from '@sim/spec_config';
import { Fragment } from 'react';

export interface ReforgeSoftCapsTooltipProps {
	player: Player<any>;
	softCaps: StatCap[];
	additionalInformation: StatTooltipContent;
}

/** The breakpoint table hanging off the optimize button. Built per open, as tippy's `onShow` did, so the limits it shows are current. */
export const ReforgeSoftCapsTooltip = ({ player, softCaps, additionalInformation }: ReforgeSoftCapsTooltipProps) => (
	<>
		<p>{i18n.t('sidebar.buttons.suggest_reforges.breakpoints_implemented')}</p>
		<table className="w-100">
			<tbody>
				{softCaps.map(({ unitStat, breakpoints, capType, postCapEPs }, index) => {
					const extra = additionalInformation[unitStat.getRootStat()]?.();
					return (
						<Fragment key={unitStat.getKey()}>
							<tr>
								<th className="text-nowrap" colSpan={2}>
									{unitStat.getShortName(player.getClass())}
								</th>
								<td className="text-end">{statCapTypeNames.get(capType)}</td>
							</tr>
							{extra !== undefined && (
								<>
									<tr>
										<td colSpan={3}>{extra}</td>
									</tr>
									<tr>
										<td colSpan={3} className="pb-2" />
									</tr>
								</>
							)}
							<tr>
								<th className="text-end">
									<em>%</em>
								</th>
								<th colSpan={2} className="text-nowrap text-end">
									<em>{i18n.t('sidebar.buttons.suggest_reforges.post_cap_ep')}</em>
								</th>
							</tr>
							{breakpoints.map((breakpoint, breakpointIndex) => (
								<tr key={breakpoint}>
									<td className="text-end">{breakpointValueToDisplayPercentage(player, breakpoint, unitStat)}</td>
									<td colSpan={2} className="text-end">
										{unitStat
											.convertEpToRatingScale(capType === StatCapType.TypeThreshold ? postCapEPs[0] : postCapEPs[breakpointIndex])
											.toFixed(2)}
									</td>
								</tr>
							))}
							{index !== softCaps.length - 1 && (
								<>
									<tr>
										<td colSpan={3} className="border-bottom pb-2" />
									</tr>
									<tr>
										<td colSpan={3} className="pb-2" />
									</tr>
								</>
							)}
						</Fragment>
					);
				})}
			</tbody>
		</table>
	</>
);
