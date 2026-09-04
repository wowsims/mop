import { Player } from '@domain/player';
import type { HunterSpecs } from '@domain/proto_utils/spec_types';
import { subscribePlayerField } from '@domain/state/subscriptions';
import { PetSpec } from '@generated/proto/hunter';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { Component } from '../component';
// Specs with corresponding icon keys
const specs: Array<{ spec: PetSpec; label: string; iconKey: string }> = [
	{ spec: PetSpec.Ferocity, label: 'Ferocity', iconKey: 'ability_druid_kingofthejungle' },
	{ spec: PetSpec.Tenacity, label: 'Tenacity', iconKey: 'ability_druid_demoralizingroar' },
	{ spec: PetSpec.Cunning, label: 'Cunning', iconKey: 'ability_eyeoftheowl' },
];

export class PetSpecPicker<SpecType extends HunterSpecs> extends Component {
	private readonly player: Player<SpecType>;
	private readonly container: HTMLDivElement;

	constructor(parent: HTMLElement, player: Player<SpecType>) {
		super(parent, 'pet-spec-picker');
		this.player = player;

		const containerRef = ref<HTMLDivElement>();

		this.rootElem.replaceChildren(
			<>
				<div className="talent-tree-header">
					<span className="talent-tree-title">Pet Spec</span>
				</div>
				<div ref={containerRef} className="talent-tree-main pet-spec-list">
					{specs.map(({ spec, label, iconKey }) => {
						const item = (
							<div className="talent-picker-root pet-spec-item" onclick={() => this.onClickSpec(spec)}>
								<div
									className="talent-picker-icon"
									style={{ backgroundImage: `url('https://wow.zamimg.com/images/wow/icons/large/${iconKey}.jpg')` }}
								/>
								<div className="talent-picker-label">{label}</div>
							</div>
						);
						// Tooltip
						const tooltip = tippy(item, { content: label });
						this.addOnDisposeCallback(() => tooltip.destroy());

						return item;
					})}
				</div>
			</>,
		);

		this.container = containerRef.value!;

		// Listen and render selection
		subscribePlayerField(player, 'specOptions')(() => this.renderActive());
		this.renderActive();
	}

	private onClickSpec(newSpec: PetSpec) {
		const current = this.player.getClassOptions().petSpec;
		if (newSpec === current) return;
		const opts = this.player.getClassOptions();
		opts.petSpec = newSpec;
		this.player.setClassOptions(opts);
	}

	private renderActive() {
		const active = this.player.getClassOptions().petSpec;
		const order = [PetSpec.Ferocity, PetSpec.Tenacity, PetSpec.Cunning];

		[...this.container.children].forEach((el, idx) => {
			const spec = order[idx];
			el.classList.toggle('selected', spec === active);
		});
	}
}
