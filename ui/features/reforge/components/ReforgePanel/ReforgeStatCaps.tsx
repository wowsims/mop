import type { ReforgeOptimizerModel } from '@features/reforge/model/reforge_optimizer';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import type { UnitStat } from '@sim/proto/stats';
import { Stats } from '@sim/proto/stats';
import { subscribeAll, subscribeReforgeField } from '@sim/state/subscriptions';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type ReactNode, useId, useMemo } from 'react';

import { ReforgeStatCapRow } from './ReforgeStatCapRow';
import { INCLUDED_STATS } from './utils';

export interface ReforgeStatCapsProps {
	model: ReforgeOptimizerModel;
	player: Player<any>;
	displayStats: UnitStat[];
	statTooltips: Partial<Record<number, ReactNode>>;
	useCustomEPValues: boolean;
}

/** The hard-cap table. Hidden rather than unmounted while custom EP values are off. */
export const ReforgeStatCaps = ({ model, player, displayStats, statTooltips, useCustomEPValues }: ReforgeStatCapsProps) => {
	const settings = model.settings;
	const capsTooltipId = useId();
	const resetTooltipId = useId();

	const subscribe = useMemo(
		() => subscribeAll([subscribeReforgeField(settings, 'useSoftCapBreakpoints'), subscribeReforgeField(settings, 'statCaps')]),
		[settings],
	);

	return (
		<table className={clsx('reforge-optimizer-stat-cap-table mb-2', !useCustomEPValues && 'hide')}>
			<thead>
				<tr>
					<th colSpan={4} className="pb-3">
						<div className="d-flex">
							<h6 className="content-block-title mb-0 me-1">{i18n.t('sidebar.buttons.suggest_reforges.edit_stat_caps')}</h6>
							<Button variant="unstyled" className="d-inline" {...tooltipAnchorProps(capsTooltipId)}>
								<Icon name="circle-question" style="regular" />
							</Button>
							<Button
								variant="unstyled"
								className="d-inline ms-auto"
								{...tooltipAnchorProps(resetTooltipId)}
								onClick={() => settings.setStatCaps(model.defaults.statCaps || new Stats())}>
								<Icon name="arrow-rotate-left" />
							</Button>
							<Tooltip id={capsTooltipId} content={i18n.t('sidebar.buttons.suggest_reforges.stat_caps_tooltip')} />
							<Tooltip id={resetTooltipId} content={i18n.t('sidebar.buttons.suggest_reforges.reset_to_defaults')} />
						</div>
					</th>
				</tr>
				<tr>
					<th>{i18n.t('sidebar.buttons.suggest_reforges.stat')}</th>
					<th colSpan={3} className="text-end">
						%
					</th>
					<th colSpan={1} className="text-start">
						Max?
					</th>
				</tr>
			</thead>
			<tbody>
				{displayStats.map(unitStat => {
					if (!unitStat.hasRootStat() || !INCLUDED_STATS.includes(unitStat.getRootStat())) return null;
					return (
						<ReforgeStatCapRow
							key={unitStat.getKey()}
							model={model}
							player={player}
							unitStat={unitStat}
							subscribe={subscribe}
							tooltip={statTooltips[unitStat.getRootStat()]}
						/>
					);
				})}
			</tbody>
		</table>
	);
};
