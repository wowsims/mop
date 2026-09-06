import type { Player } from '@domain/player';
import type { TalentsConfig } from '@domain/talents/config';
import { classGlyphsConfig } from '@domain/talents/factory';
import { usePlayer } from '@features/SimHostContext';
import { GlyphsPicker } from '@features/talents/view/glyphs_picker';
import type { Class } from '@generated/proto/common';
import i18n from '@i18n/config';
import { CopyButton } from '@ui-kit/copy_button';
import { useInput } from '@ui-kit/hooks/useInput';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import { useId } from 'react';

import { TalentTreePicker } from './TalentTreePicker';

export interface TalentsPickerConfig<ModObject, TalentsProto> extends InputConfig<ModObject, string> {
	tree: TalentsConfig<TalentsProto>;
}

export interface TalentsPickerProps<TalentsProto> {
	config: TalentsPickerConfig<Player<any>, TalentsProto>;
}

export const TalentsPicker = <TalentsProto,>({ config }: TalentsPickerProps<TalentsProto>) => {
	const player = usePlayer();
	const fallbackId = useId();
	const { value, setValue, hidden, disabled } = useInput(player, config);

	const mountActions = useLegacyMount(
		parent =>
			new CopyButton(parent, {
				extraCssClasses: ['btn-sm', 'btn-outline-primary', 'copy-talents'],
				getContent: () => player.getTalentsString(),
				text: i18n.t('talents_tab.copy_button.label'),
				tooltip: i18n.t('talents_tab.copy_button.tooltip'),
			}),
		[player],
	);

	const mountGlyphs = useLegacyMount(parent => new GlyphsPicker(parent, player, classGlyphsConfig[player.getClass() as Class]), [player]);

	return (
		<PickerShell ref={mountGlyphs} config={{ ...config, id: config.id ?? fallbackId }} cssClass="talents-picker-root" hidden={hidden} disabled={disabled}>
			<div className="talents-picker-inner">
				<div className="talents-picker-header">
					<div className="talents-picker-actions" ref={mountActions} />
				</div>
				<div id="talents" className="talents-picker-list">
					<TalentTreePicker config={config.tree} talentsString={value} onChange={setValue} />
				</div>
			</div>
		</PickerShell>
	);
};
