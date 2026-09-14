import type { ConsumableStatOption } from '@features/settings/model/consumables';
import type { Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { Database } from '@sim/proto/database';
import type { IconInputConfig } from '@ui-kit/icon_inputs';
import { IconEnumPicker } from '@ui-kit/IconEnumPicker';
import { IconPicker } from '@ui-kit/IconPicker';
import { PickerGroup } from '@ui-kit/PickerGroup';
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
		<div className="grid gap-3 max-lg:grid-cols-3 max-md:grid-cols-1">
			<ConsumeRow name="potions" configs={[configs.potion, configs.conjured, configs.prepot]}>
				<PickerGroup variant="icons" className="justify-end" data-testid="consumes-potions">
					<IconEnumPicker modObject={player} config={configs.prepot} />
					<IconEnumPicker modObject={player} config={configs.potion} />
					<IconEnumPicker modObject={player} config={configs.conjured} />
				</PickerGroup>
			</ConsumeRow>
			<ConsumeRow name="elixirs">
				<PickerGroup variant="icons" className="justify-end">
					<div data-testid="consumes-flasks">
						<IconEnumPicker modObject={player} config={configs.flask} />
					</div>
					<span className="w-10 flex items-center justify-center">{i18n.t('settings_tab.consumables.elixirs.separator')}</span>
					<div className="empty:hidden" data-testid="consumes-battle-elixirs">
						<IconEnumPicker modObject={player} config={configs.battleElixir} />
					</div>
					<div className="empty:hidden" data-testid="consumes-guardian-elixirs">
						<IconEnumPicker modObject={player} config={configs.guardianElixir} />
					</div>
				</PickerGroup>
			</ConsumeRow>
			<ConsumeRow name="food">
				<PickerGroup variant="icons" className="justify-end" data-testid="consumes-food">
					<IconEnumPicker modObject={player} config={configs.food} />
				</PickerGroup>
			</ConsumeRow>
			<ConsumeRow name="engineering" configs={[configs.explosive]}>
				<PickerGroup variant="icons" className="justify-end" data-testid="consumes-engi">
					<IconEnumPicker modObject={player} config={configs.explosive} />
				</PickerGroup>
			</ConsumeRow>
			{petInputs.length > 0 && (
				<ConsumeRow name="pet">
					<PickerGroup variant="icons" className="justify-end">
						{petInputs.map((config, index) =>
							config.type === 'icon' ? (
								<IconPicker key={index} modObject={player} config={config} />
							) : (
								<IconEnumPicker key={index} modObject={player} config={config} />
							),
						)}
					</PickerGroup>
				</ConsumeRow>
			)}
		</div>
	);
};
