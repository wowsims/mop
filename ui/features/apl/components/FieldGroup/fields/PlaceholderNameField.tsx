import { AplNameDialog } from '@features/apl/components/AplNameDialog';
import { NameDisplay } from '@features/apl/components/NameDisplay';
import { clearPlaceholder, findContainingGroup, placeholderNames, renamePlaceholder } from '@features/apl/model/placeholders';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import { useInput } from '@ui-kit/hooks/useInput';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import { useState } from 'react';

export interface PlaceholderNameFieldProps {
	player: Player<any>;
	config: InputConfig<Player<any>, string> & { id: string };
	/** The placeholder message this names, which is what locates its group. */
	getParentValue: () => any;
}

const label = (key: string) => i18n.t(`rotation_tab.apl.variablePlaceholder.${key}`);

/**
 * The name of a variable placeholder, edited through the name dialog.
 *
 * A freshly created placeholder has no name, and the dialog opens on its own for it — dismissing
 * that dialog deletes the placeholder again, which is the only way out of a nameless one. Renaming
 * an existing placeholder re-points every use of the old name **within its own group**, and the
 * group references that pass a variable of that name; two groups may each have a `target` and they
 * are unrelated.
 */
export const PlaceholderNameField = ({ player, config, getParentValue }: PlaceholderNameFieldProps) => {
	const { value, setValue, hidden, disabled } = useInput(player, config);
	const [open, setOpen] = useState(() => !config.getValue(player));

	const isNew = !value;
	const group = open ? findContainingGroup(player.aplRotation, getParentValue()) : undefined;
	const existingNames = open ? placeholderNames(group).filter(name => isNew || name !== value) : [];

	return (
		<PickerShell config={config} className="apl-placeholder-name-picker-root" hidden={hidden} disabled={disabled}>
			<NameDisplay name={value} onRename={() => setOpen(true)} />
			<AplNameDialog
				open={open}
				title={
					isNew
						? i18n.t('rotation_tab.apl.floatingActionBar.new', { itemName: label('name') })
						: i18n.t('rotation_tab.apl.nameModal.rename', { itemName: label('name') })
				}
				inputLabel={label('nameLabel')}
				confirmLabel={isNew ? undefined : i18n.t('rotation_tab.apl.nameModal.renameConfirm')}
				defaultValue={value}
				existingNames={existingNames}
				onSubmit={name => {
					if (value && group) renamePlaceholder(player.aplRotation, group, value, name);
					setValue(name);
				}}
				onCancel={isNew ? () => player.modifyAplRotation(rotation => void clearPlaceholder(rotation, getParentValue())) : undefined}
				onClose={() => setOpen(false)}
			/>
		</PickerShell>
	);
};
