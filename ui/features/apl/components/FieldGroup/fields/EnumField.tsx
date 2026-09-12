import type { EnumTable } from '@features/apl/model/field_specs';
import type { Player } from '@sim/player/player';
import { DropdownField } from '@ui-kit/DropdownPicker';
import type { InputConfig } from '@ui-kit/input';

export interface EnumFieldProps {
	player: Player<any>;
	config: InputConfig<Player<any>, number> & { id: string };
	table: EnumTable;
}

/** A field whose values are a fixed proto enum. The lists themselves are data, in `model/field_specs.ts`. */
export const EnumField = ({ player, config, table }: EnumFieldProps) => (
	<DropdownField<Player<any>, number> modObject={player} config={config} options={table.options} defaultLabel={table.defaultLabel} />
);
