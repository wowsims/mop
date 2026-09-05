import type { Player } from '@domain/player';
import type { HunterSpecs } from '@domain/proto_utils/spec_types';
import { subscribePlayerField } from '@domain/state/subscriptions';
import { PetSpec } from '@generated/proto/hunter';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { Tooltip } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId, useMemo } from 'react';

export interface PetSpecPickerProps<SpecType extends HunterSpecs> {
	player: Player<SpecType>;
}

// Order is display order, and `renderActive` matched by index — so it is the data, not a lookup.
const SPECS: ReadonlyArray<{ spec: PetSpec; label: string; iconKey: string }> = [
	{ spec: PetSpec.Ferocity, label: 'Ferocity', iconKey: 'ability_druid_kingofthejungle' },
	{ spec: PetSpec.Tenacity, label: 'Tenacity', iconKey: 'ability_druid_demoralizingroar' },
	{ spec: PetSpec.Cunning, label: 'Cunning', iconKey: 'ability_eyeoftheowl' },
];

/**
 * The hunter pet's spec. It wears the talent tree's class names deliberately — `talent-tree-*` and
 * `talent-picker-*` — because it piggybacks on that stylesheet rather than carrying one of its own.
 * Moving those styles into a talents component would take this with them.
 */
export const PetSpecPicker = <SpecType extends HunterSpecs>({ player }: PetSpecPickerProps<SpecType>) => {
	const id = useId();
	const subscribe = useMemo(() => subscribePlayerField(player, 'specOptions'), [player]);
	const active = useStoreSubscribe(subscribe, () => player.getClassOptions().petSpec);

	// The options object is read, mutated and written back, which is what the facade expects.
	const select = (spec: PetSpec) => {
		if (spec === player.getClassOptions().petSpec) return;
		const options = player.getClassOptions();
		options.petSpec = spec;
		player.setClassOptions(options);
	};

	return (
		<div className="pet-spec-picker">
			<div className="talent-tree-header">
				<span className="talent-tree-title">Pet Spec</span>
			</div>
			<div className="talent-tree-main pet-spec-list">
				{SPECS.map(({ spec, label, iconKey }) => (
					<div
						key={spec}
						className={clsx('talent-picker-root pet-spec-item', spec === active && 'selected')}
						data-tooltip-id={`${id}-${spec}`}
						onClick={() => select(spec)}>
						<div className="talent-picker-icon" style={{ backgroundImage: `url('https://wow.zamimg.com/images/wow/icons/large/${iconKey}.jpg')` }} />
						<div className="talent-picker-label">{label}</div>
						<Tooltip id={`${id}-${spec}`} content={label} />
					</div>
				))}
			</div>
		</div>
	);
};
