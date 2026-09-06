import type { Player } from '@domain/player';
import { ItemSwapPicker } from '@features/item-swap';
import type { InputConfig } from '@features/spec_config';
import type { ItemSlot } from '@generated/proto/common';

import { InputPicker } from '../InputPicker';

export interface OtherSettingsProps {
	inputs: ReadonlyArray<InputConfig<Player<any>>>;
	itemSlots: ReadonlyArray<ItemSlot>;
}

export const OtherSettings = ({ inputs, itemSlots }: OtherSettingsProps) => (
	<>
		{inputs.map(config => (
			<InputPicker key={config.id} config={{ ...config, inline: true }} />
		))}
		{itemSlots.length > 0 && <ItemSwapPicker itemSlots={itemSlots} />}
	</>
);
