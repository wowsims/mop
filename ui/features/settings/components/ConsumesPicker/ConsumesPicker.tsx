import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { Database } from '@sim/proto/database';
import type { ConsumableStatOption } from '@features/settings/model/consumables';
import type { Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { IconInputConfig } from '@ui-kit/icon_inputs';
import { IconEnumPicker } from '@ui-kit/IconEnumPicker';
import { IconPicker } from '@ui-kit/IconPicker';
import { useMemo } from 'react';

import { ConsumeRow } from './ConsumeRow';
import { consumeConfigs } from './utils';

export interface ConsumesPickerProps {
	consumableStats: ReadonlyArray<Stat>;
	conjuredOptions: ReadonlyArray<ConsumableStatOption<number>>;
	explosiveOptions: ReadonlyArray<ConsumableStatOption<number>>;
	petInputs: ReadonlyArray<IconInputConfig<Player<any>, any>>;
}

export const ConsumesPicker = ({ consumableStats, conjuredOptions, explosiveOptions, petInputs }: ConsumesPickerProps) => {
	const player = usePlayer() as Player<any>;
	const configs = useMemo(
		() => consumeConfigs(player, Database.getSync(), consumableStats, conjuredOptions, explosiveOptions),
		[player, consumableStats, conjuredOptions, explosiveOptions],
	);

	return (
		<div className="consumes-picker-root grid gap-3 max-lg:grid-cols-3 max-md:grid-cols-1">
			<ConsumeRow name="potions" configs={[configs.potion, configs.conjured, configs.prepot]}>
				<div className="picker-group icon-group consumes-row-inputs consumes-potions justify-end">
					<IconEnumPicker modObject={player} config={configs.prepot} />
					<IconEnumPicker modObject={player} config={configs.potion} />
					<IconEnumPicker modObject={player} config={configs.conjured} />
				</div>
			</ConsumeRow>
			<ConsumeRow name="elixirs">
				<div className="picker-group icon-group consumes-row-inputs justify-end">
					<div className="consumes-flasks">
						<IconEnumPicker modObject={player} config={configs.flask} />
					</div>
					<span className="elixir-space w-10 flex items-center justify-center">{i18n.t('settings_tab.consumables.elixirs.separator')}</span>
					<div className="consumes-battle-elixirs empty:hidden">
						<IconEnumPicker modObject={player} config={configs.battleElixir} />
					</div>
					<div className="consumes-guardian-elixirs empty:hidden">
						<IconEnumPicker modObject={player} config={configs.guardianElixir} />
					</div>
				</div>
			</ConsumeRow>
			<ConsumeRow name="food">
				<div className="picker-group icon-group consumes-row-inputs consumes-food justify-end">
					<IconEnumPicker modObject={player} config={configs.food} />
				</div>
			</ConsumeRow>
			<ConsumeRow name="engineering" configs={[configs.explosive]}>
				<div className="picker-group icon-group consumes-row-inputs consumes-engi justify-end">
					<IconEnumPicker modObject={player} config={configs.explosive} />
				</div>
			</ConsumeRow>
			{petInputs.length > 0 && (
				<ConsumeRow name="pet">
					<div className="picker-group icon-group consumes-row-inputs consumes-pet justify-end">
						{petInputs.map((config, index) =>
							config.type === 'icon' ? (
								<IconPicker key={index} modObject={player} config={config} />
							) : (
								<IconEnumPicker key={index} modObject={player} config={config} />
							),
						)}
					</div>
				</ConsumeRow>
			)}
		</div>
	);
};
