import type { Player } from '@domain/player';
import { Database } from '@domain/proto_utils/database';
import type { ConsumableStatOption } from '@features/settings/model/consumables';
import { usePlayer } from '@features/SimHostContext';
import type { Stat } from '@generated/proto/common';
import type { IconInputConfig } from '@ui-kit/icon_inputs';
import { IconEnumPicker } from '@ui-kit/IconEnumPicker';
import { IconPicker } from '@ui-kit/IconPicker';
import { useMemo } from 'react';

import { ConsumeRow } from './ConsumeRow';
import { consumeConfigs } from './utils';

export interface ConsumesPickerProps {
	/** `consumableStats ?? epStats` — what the database filters the item lists on. */
	consumableStats: ReadonlyArray<Stat>;
	/** `CONJURED_CONFIG` after `relevantStatOptions`. */
	conjuredOptions: ReadonlyArray<ConsumableStatOption<number>>;
	/** `EXPLOSIVE_CONFIG` after `relevantStatOptions`. */
	explosiveOptions: ReadonlyArray<ConsumableStatOption<number>>;
	/** `petConsumeInputs` — declared by a handful of specs, and the row is absent without it. */
	petInputs: ReadonlyArray<IconInputConfig<Player<any>, any>>;
}

/**
 * The Consumables block: five labelled rows of icon-enum pickers.
 *
 * It fixes the row order and which field each picker writes; what varies is the item lists, which
 * come from the database filtered by the spec's stats, and the pet row, which only a few specs
 * declare.
 *
 * **`Database.getSync()` is a hard dependency, not an inherited one.** Every other ported settings
 * block would merely render early if `SimApp` stopped gating on `useSimReady`; this one throws. The
 * lists are read once, in a memo, exactly as the vanilla `create()` read them once in its factory.
 */
export const ConsumesPicker = ({ consumableStats, conjuredOptions, explosiveOptions, petInputs }: ConsumesPickerProps) => {
	const player = usePlayer() as Player<any>;
	const configs = useMemo(
		() => consumeConfigs(player, Database.getSync(), consumableStats, conjuredOptions, explosiveOptions),
		[player, consumableStats, conjuredOptions, explosiveOptions],
	);

	return (
		<div className="consumes-picker-root">
			{/* The three potion pickers are one row and hide together, which is the only place the
			    block's own visibility rule bites besides Engineering. */}
			<ConsumeRow name="potions" configs={[configs.potion, configs.conjured, configs.prepot]}>
				<div className="picker-group icon-group consumes-row-inputs consumes-potions">
					<IconEnumPicker modObject={player} config={configs.prepot} />
					<IconEnumPicker modObject={player} config={configs.potion} />
					<IconEnumPicker modObject={player} config={configs.conjured} />
				</div>
			</ConsumeRow>
			<ConsumeRow name="elixirs">
				<div className="picker-group icon-group consumes-row-inputs">
					<div className="consumes-flasks">
						<IconEnumPicker modObject={player} config={configs.flask} />
					</div>
					{/* Not translated on either build — `_shared.scss` sizes it as a spacer between the
					    flask and the elixirs. Flagged rather than changed. */}
					<span className="elixir-space">or</span>
					<div className="consumes-battle-elixirs">
						<IconEnumPicker modObject={player} config={configs.battleElixir} />
					</div>
					<div className="consumes-guardian-elixirs">
						<IconEnumPicker modObject={player} config={configs.guardianElixir} />
					</div>
				</div>
			</ConsumeRow>
			<ConsumeRow name="food">
				<div className="picker-group icon-group consumes-row-inputs consumes-food">
					<IconEnumPicker modObject={player} config={configs.food} />
				</div>
			</ConsumeRow>
			<ConsumeRow name="engineering" configs={[configs.explosive]}>
				<div className="picker-group icon-group consumes-row-inputs consumes-engi">
					<IconEnumPicker modObject={player} config={configs.explosive} />
				</div>
			</ConsumeRow>
			{/* A conditional render rather than a `hide` class: vanilla built no row at all for a spec
			    with no pet inputs, so the elements are absent on both builds. */}
			{petInputs.length > 0 && (
				<ConsumeRow name="pet">
					<div className="picker-group icon-group consumes-row-inputs consumes-pet">
						{petInputs.map((config, index) =>
							// The lists are module-level constants that never reorder and the configs carry
							// no id, so the index is the key.
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
