/** @jsxImportSource @jsx-vanilla */
import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { isEqualAPLRotation } from '@sim/proto_utils/apl_utils';
import type { IndividualSimHost } from '@sim/sim_host';
import { subscribeSimChange } from '@sim/state/subscriptions';
import { applyBuild } from '@features/settings/model/apply_build';
import { ConsumesSpec, Debuffs, Encounter, EquipmentSpec, HealingModel, IndividualBuffs, ItemSwap, RaidBuffs, Spec } from '@generated/proto/common';
import { SavedTalents } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { translatePresetConfigurationCategory } from '@i18n/localization';
import { Component } from '@ui-kit/component';
import { ContentBlock } from '@ui-kit/content_block';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { buildCategories, isBuildActive } from './preset_build_state';
import { PresetBuild } from './preset_utils';
export class PresetConfigurationPicker extends Component {
	readonly simUI: IndividualSimHost<Spec>;
	readonly builds: Array<PresetBuild>;

	constructor(parentElem: HTMLElement, simUI: IndividualSimHost<Spec>, types?: PresetConfigurationCategory[]) {
		super(parentElem, 'preset-configuration-picker-root');
		this.rootElem.classList.add('saved-data-manager-root');

		this.simUI = simUI;
		this.builds = (this.simUI.individualConfig.presets.builds ?? []).filter(build =>
			Object.keys(build).some(category => types?.includes(category as PresetConfigurationCategory) && !!build[category as PresetConfigurationCategory]),
		);

		if (!this.builds.length) {
			this.rootElem.classList.add('hide');
			return;
		}

		const contentBlock = new ContentBlock(this.rootElem, 'saved-data', {
			header: {
				title: i18n.t('gear_tab.preset_configurations.title'),
				tooltip: i18n.t('gear_tab.preset_configurations.tooltip'),
			},
		});

		const buildsContainerRef = ref<HTMLDivElement>();

		const container = (
			<div className="saved-data-container">
				<div className="saved-data-presets" ref={buildsContainerRef}></div>
			</div>
		);

		this.simUI.sim.waitForInit().then(() => {
			this.builds.forEach(build => {
				const dataElemRef = ref<HTMLButtonElement>();
				buildsContainerRef.value!.appendChild(
					<button className="saved-data-set-chip badge rounded-pill" ref={dataElemRef}>
						<span
							className="saved-data-set-name"
							attributes={{ role: 'button' }}
							onclick={() => {
								applyBuild(build, this.simUI);
							}}>
							{build.name}
						</span>
					</button>,
				);

				const categories = buildCategories(build);

				const tooltip = tippy(dataElemRef.value!, {
					content: (
						<>
							<p className="mb-1">{i18n.t('common.preset.description')}</p>
							<ul className="mb-0">
								{categories.map(category => (
									<li>{category}</li>
								))}
							</ul>
						</>
					),
				});
				this.addOnDisposeCallback(() => tooltip.destroy());

				const checkActive = () => dataElemRef.value!.classList[isBuildActive(build, this.simUI) ? 'add' : 'remove']('active');

				checkActive();
				this.addOnDisposeCallback(subscribeSimChange(this.simUI.sim)(checkActive));
			});
			contentBlock.bodyElement.replaceChildren(container);
		});
	}
}
