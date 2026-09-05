import { PresetConfigurationCategory } from '@domain/constants/preset_categories';
import type { Player } from '@domain/player';
import { batch } from '@domain/state/batch';
import { subscribeAll, subscribePlayerField } from '@domain/state/subscriptions';
import { classTalentsConfig } from '@domain/talents/factory';
import { useSimHost } from '@features/SimHostContext';
import { TalentsPicker } from '@features/talents/components/TalentsPicker';
import { Class, Glyphs } from '@generated/proto/common';
import { SavedTalents } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import { PetSpecPicker } from '@ui-kit/PetSpecPicker';
import { SavedDataManager } from '@ui-kit/saved_data_manager';
import { useMemo } from 'react';

import { trackEvent } from '../../tracking/analytics';
import { PresetConfigurationPicker } from '../preset_configuration_picker';

/**
 * The talents tab's contents, rendered by React into the pane `TalentsTab` registers. It lives in
 * `app/tabs` rather than `features/` because assembling feature components is what a tab does, and
 * `PresetConfigurationPicker` is in `app/`, which `features/**` may not import.
 *
 * The left panel is React's: `TalentsPicker` renders it, and the hunter pet-spec picker beside it.
 * The right panel's two components mount through `useLegacyMount`, which builds them into the panel
 * rather than into wrappers of its own, so the pane's DOM is the shape it always was and
 * `panes-parity.mjs` still compares like for like.
 *
 * `PresetConfigurationPicker` and `SavedDataManager` are deliberately not ported with this tab: four
 * tabs build the first and several build the second, so porting them here would drag settings,
 * rotation and gear along with it.
 */
export const TalentsTabBody = () => {
	const host = useSimHost();
	const player = host.player;

	const talentsConfig = useMemo(
		() => ({
			tree: classTalentsConfig[player.getClass()]!,
			storeSubscribe: (subject: Player<any>) => subscribePlayerField(subject, 'talentsString'),
			getValue: (subject: Player<any>) => subject.getTalentsString(),
			setValue: (subject: Player<any>, newValue: string) => {
				trackEvent({ action: 'settings', category: 'talents', label: 'update' });
				subject.setTalentsString(newValue);
			},
		}),
		[player],
	);

	const mountRight = useLegacyMount(
		parent => {
			const presets = new PresetConfigurationPicker(parent, host, [PresetConfigurationCategory.Talents]);
			const saved = new SavedDataManager<Player<any>, SavedTalents>(parent, player, {
				label: i18n.t('talents_tab.saved_talents.label'),
				header: { title: i18n.t('talents_tab.saved_talents.title') },
				storageKey: host.getSavedTalentsStorageKey(),
				getData: (subject: Player<any>) => SavedTalents.create({ talentsString: subject.getTalentsString(), glyphs: subject.getGlyphs() }),
				setData: (subject: Player<any>, newTalents: SavedTalents) => {
					batch(() => {
						subject.setTalentsString(newTalents.talentsString);
						subject.setGlyphs(newTalents.glyphs || Glyphs.create());
					});
				},
				subscribe: subscribeAll([subscribePlayerField(player, 'talentsString'), subscribePlayerField(player, 'glyphs')]),
				toJson: (a: SavedTalents) => SavedTalents.toJson(a),
				fromJson: (obj: any) => SavedTalents.fromJson(obj),
				nameLabel: i18n.t('talents_tab.saved_talents.name_label'),
				saveButtonText: i18n.t('talents_tab.saved_talents.save_button'),
				deleteTooltip: i18n.t('talents_tab.saved_talents.delete.tooltip'),
				deleteConfirmMessage: i18n.t('talents_tab.saved_talents.delete.confirm'),
				chooseNameAlert: i18n.t('talents_tab.saved_talents.alerts.choose_name'),
				nameExistsAlert: i18n.t('talents_tab.saved_talents.alerts.name_exists'),
			});

			// Presets are only known once the database has loaded; the tab is built long before that.
			host.sim.waitForInit().then(() => {
				saved.loadUserData();
				host.individualConfig.presets.talents.forEach(config => {
					config.isPreset = true;
					saved.addSavedData({ name: config.name, isPreset: true, data: config.data, onLoad: config.onLoad });
				});
			});

			return [presets, saved];
		},
		[player, host],
	);

	// Portalled into `SimTab`'s own `.tab-pane-content-container`, so this renders only the panels.
	return (
		<>
			<div className="talents-tab-left tab-panel-left">
				<TalentsPicker config={talentsConfig} />
				{/* Hunters pick a pet spec; every other class has none, and vanilla renders nothing. */}
				{player.isClass(Class.ClassHunter) && <PetSpecPicker player={player} />}
			</div>
			<div className="talents-tab-right tab-panel-right" ref={mountRight} />
		</>
	);
};
