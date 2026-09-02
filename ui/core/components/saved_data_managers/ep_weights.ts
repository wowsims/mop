import { Player } from '@domain/player';
import { Stats } from '@domain/proto_utils/stats';
import { batch } from '@domain/state/batch';
import { subscribePlayerField } from '@domain/state/subscriptions';
import { SavedDataManager, SavedDataManagerConfig } from '@ui-kit/saved_data_manager';

import i18n from '../../../i18n/config';
import { IndividualSimUI } from '../../individual_sim_ui';
import { SavedEPWeights } from '../../proto/ui';
export const renderSavedEPWeights = (
	container: HTMLElement | null,
	simUI: IndividualSimUI<any>,
	options?: Partial<SavedDataManagerConfig<Player<any>, SavedEPWeights>>,
) => {
	const savedEPWeightsManager = new SavedDataManager<Player<any>, SavedEPWeights>(container, simUI.player, {
		label: i18n.t('sidebar.buttons.stat_weights.modal.ep'),
		nameLabel: i18n.t('sidebar.buttons.stat_weights.title'),
		header: { title: i18n.t('sidebar.buttons.stat_weights.saved_ep_weights.title') },
		storageKey: simUI.getSavedEPWeightsStorageKey(),
		getData: player =>
			SavedEPWeights.create({
				epWeights: player.getEpWeights().toProto(),
			}),
		setData: (eventID, player, newEPWeights) => {
			batch(() => {
				player.setEpWeights(eventID, Stats.fromProto(newEPWeights.epWeights));
			});
		},
		subscribe: subscribePlayerField(simUI.player, 'epWeights'),
		toJson: a => SavedEPWeights.toJson(a),
		fromJson: obj => SavedEPWeights.fromJson(obj),
		...options,
	});

	simUI.sim.waitForInit().then(() => {
		savedEPWeightsManager.loadUserData();
		simUI.individualConfig.presets.epWeights.forEach(({ name, epWeights, enableWhen, onLoad }) => {
			savedEPWeightsManager.addSavedData({
				name: name,
				isPreset: true,
				data: SavedEPWeights.create({
					epWeights: epWeights.toProto(),
				}),
				enableWhen,
				onLoad,
			});
		});
	});

	return savedEPWeightsManager;
};
