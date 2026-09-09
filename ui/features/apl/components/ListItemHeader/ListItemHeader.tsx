import type { APLValidation } from '@generated/proto/api';
import type { Player } from '@sim/player/player';

import { AplValidations } from './AplValidations';
import { HidePicker } from './HidePicker';

export interface ListItemHeaderProps<T extends { hide: boolean }> {
	player: Player<any>;
	/** This row, read fresh — the eye toggles its `hide` flag. */
	getItem: (player: Player<any>) => T | undefined;
	getValidations: (player: Player<any>) => Array<APLValidation>;
}

/** What an APL list row adds to its header: its validations, then its eye, in that order. */
export const ListItemHeader = <T extends { hide: boolean }>({ player, getItem, getValidations }: ListItemHeaderProps<T>) => (
	<>
		<AplValidations getValidations={getValidations} />
		<HidePicker
			player={player}
			config={{
				getValue: () => !!getItem(player)?.hide,
				setValue: (subject: Player<any>, newValue: boolean) => {
					const item = getItem(subject);
					if (!item) return;
					item.hide = newValue;
					subject.touchRotation();
				},
			}}
		/>
	</>
);
