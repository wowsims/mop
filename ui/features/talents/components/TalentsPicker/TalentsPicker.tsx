import type { Player } from '@domain/player';
import type { TalentsConfig } from '@domain/talents/config';
import { classGlyphsConfig } from '@domain/talents/factory';
import { GlyphsPicker } from '@features/talents/view/glyphs_picker';
import type { Class, Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { CopyButton } from '@ui-kit/copy_button';
import { useInput } from '@ui-kit/hooks/useInput';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import { useId } from 'react';

import { TalentTreePicker } from './TalentTreePicker';

export interface TalentsPickerConfig<ModObject, TalentsProto> extends InputConfig<ModObject, string> {
	playerClass: Class;
	playerSpec: Spec;
	tree: TalentsConfig<TalentsProto>;
}

export interface TalentsPickerProps<TalentsProto> {
	player: Player<any>;
	config: TalentsPickerConfig<Player<any>, TalentsProto>;
}

/**
 * The talents tab's tree, bound to `Player.talentsString` through the `InputConfig` its call site
 * hands it. It is an `Input` on the vanilla side, so it renders through `PickerShell` — that is what
 * reproduces the `input-root talents-picker-root` element the `Input` constructor built.
 *
 * Two things inside it are still vanilla and mount through `useLegacyMount`, which builds into the
 * React-rendered element instead of a wrapper of its own:
 *
 * - `CopyButton` is a `ui-kit` primitive with three other consumers, so it is dual-stack until they
 *   port; its root *is* the button, so a wrapper would show up in the pane diff.
 * - `GlyphsPicker` owns a `BaseModal`, which has no React equivalent yet. It mounts on the picker
 *   root, where the vanilla constructor appended it — a ref callback runs after React has committed
 *   this element's children, so appending there lands it after `.talents-picker-inner`, which is the
 *   order `.talents-picker-root`'s flex row expects.
 */
export const TalentsPicker = <TalentsProto,>({ player, config }: TalentsPickerProps<TalentsProto>) => {
	// `PickerShell` needs an id for the label's `htmlFor`; this config carries no label, and vanilla
	// passed `config.id || undefined` there, so nothing renders it either way.
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

	// Vanilla gated this on `isPlayer()` — whether the mod object has a `playerClass`. The React
	// component takes a `Player`, so the gate has nothing left to decide.
	const mountGlyphs = useLegacyMount(parent => new GlyphsPicker(parent, player, classGlyphsConfig[player.getClass()]), [player]);

	return (
		<PickerShell ref={mountGlyphs} config={{ ...config, id: config.id ?? fallbackId }} cssClass="talents-picker-root" hidden={hidden} disabled={disabled}>
			<div className="talents-picker-inner">
				<div className="talents-picker-header">
					<div className="talents-picker-actions" ref={mountActions} />
				</div>
				<div id="talents" className="talents-picker-list">
					<TalentTreePicker
						config={config.tree}
						playerClass={config.playerClass}
						playerSpec={config.playerSpec}
						talentsString={value}
						onChange={setValue}
					/>
				</div>
			</div>
		</PickerShell>
	);
};
