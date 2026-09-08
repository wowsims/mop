import type { ReforgeOptimizerModel } from '@features/reforge/model/reforge_optimizer';
import { toDefaultUnitStatValue, toVisualUnitStatPercentage } from '@features/reforge/model/utils';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import type { UnitStat } from '@sim/proto/stats';
import type { StoreSubscribe } from '@sim/state/subscriptions';
import { subscribeReforgeChange } from '@sim/state/subscriptions';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { Button } from '@ui-kit/Button';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { Icon } from '@ui-kit/Icon';
import { NumberPicker } from '@ui-kit/NumberPicker';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { type ReactNode, useId, useMemo } from 'react';

export interface ReforgeStatCapRowProps {
	model: ReforgeOptimizerModel;
	player: Player<any>;
	unitStat: UnitStat;
	/** The two fields a cap reads, composed once by the table so the store sees one selector per field. */
	subscribe: StoreSubscribe;
	tooltip: ReactNode;
}

/** One stat's cap: the percentage, the undershoot flag, and — where the spec supplies them — a preset select on its own row. */
export const ReforgeStatCapRow = ({ model, player, unitStat, subscribe, tooltip }: ReforgeStatCapRowProps) => {
	const settings = model.settings;
	const statName = unitStat.getShortName(player.getClass());
	const tooltipId = useId();

	const storeSubscribe = () => subscribe;
	const getValue = () => toVisualUnitStatPercentage(player, settings.statCaps.getUnitStat(unitStat), unitStat);
	const setValue = (_player: Player<any>, newValue: number) =>
		settings.setStatCaps(settings.statCaps.withUnitStat(unitStat, toDefaultUnitStatValue(player, newValue, unitStat)));
	const enableWhen = () => model.isAllowedToOverrideStatCaps || !model.softCapsConfig.some(config => config.unitStat.equals(unitStat));

	const statPresets = model.statSelectionPresets?.find(entry => entry.unitStat.equals(unitStat))?.presets;
	const presetValues = useMemo(
		() =>
			statPresets
				? [
						{ name: i18n.t('sidebar.buttons.suggest_reforges.select_preset'), value: 0 },
						...[...statPresets.entries()].map(([key, percentValue]) => ({ name: `${key} - ${percentValue.toFixed(2)}%`, value: percentValue })),
					].sort((a, b) => a.value - b.value)
				: null,
		[statPresets],
	);

	return (
		<>
			<tr className="reforge-optimizer-stat-cap-item">
				<td>
					<div className="reforge-optimizer-stat-cap-item-label">
						{statName}{' '}
						{!!tooltip && (
							<>
								<Button variant="unstyled" className="d-inline" {...tooltipAnchorProps(tooltipId)}>
									<Icon name="circle-question" style="regular" />
								</Button>
								<Tooltip id={tooltipId} content={tooltip} />
							</>
						)}
					</div>
				</td>
				<td colSpan={3}>
					<NumberPicker
						modObject={player}
						config={{
							id: `reforge-optimizer-${statName}-percentage`,
							float: true,
							maxDecimalDigits: 5,
							showZeroes: false,
							positive: true,
							extraCssClasses: ['mb-0'],
							enableWhen,
							storeSubscribe,
							getValue,
							setValue,
						}}
					/>
				</td>
				<td colSpan={1} className="text-end">
					<BooleanPicker
						modObject={player}
						config={{
							id: `reforge-optimizer-${statName}-undershoot`,
							label: '',
							inline: false,
							storeSubscribe: () => subscribeReforgeChange(settings),
							getValue: () => settings.undershootCaps.getUnitStat(unitStat) > 0,
							setValue: (_player, newValue) => {
								settings.undershootCaps = settings.undershootCaps.withUnitStat(unitStat, newValue ? 1 : 0);
							},
						}}
					/>
				</td>
			</tr>
			{presetValues && (
				<tr>
					<td />
					<td colSpan={3}>
						<EnumPicker
							modObject={player}
							config={{
								id: `reforge-optimizer-${statName}-presets`,
								extraCssClasses: ['mb-0'],
								label: '',
								values: presetValues,
								enableWhen,
								storeSubscribe,
								getValue,
								setValue,
							}}
						/>
					</td>
				</tr>
			)}
		</>
	);
};
