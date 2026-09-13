import { PetSpec } from '@generated/proto/hunter';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { Player } from '@sim/player/player';
import type { HunterSpecs } from '@sim/proto/spec_types';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId } from 'react';

export interface PetSpecPickerProps<SpecType extends HunterSpecs> {
	player: Player<SpecType>;
}

const SPECS: ReadonlyArray<{ spec: PetSpec; label: string; iconKey: string }> = [
	{ spec: PetSpec.Ferocity, label: 'Ferocity', iconKey: 'ability_druid_kingofthejungle' },
	{ spec: PetSpec.Tenacity, label: 'Tenacity', iconKey: 'ability_druid_demoralizingroar' },
	{ spec: PetSpec.Cunning, label: 'Cunning', iconKey: 'ability_eyeoftheowl' },
];

/** It wears the talent tree's class names deliberately — `talent-tree-*` and `talent-picker-*` — because it piggybacks on that stylesheet rather than carrying one of its own. */
export const PetSpecPicker = <SpecType extends HunterSpecs>({ player }: PetSpecPickerProps<SpecType>) => {
	const id = useId();
	const subscribe = subscribePlayerField(player, 'specOptions');
	const active = useStoreSubscribe(subscribe, () => player.getClassOptions().petSpec);

	// The options object is read, mutated and written back, which is what the facade expects.
	const select = (spec: PetSpec) => {
		if (spec === player.getClassOptions().petSpec) return;
		const options = player.getClassOptions();
		options.petSpec = spec;
		player.setClassOptions(options);
	};

	return (
		<div className="pet-spec-picker col-span-full w-full flex flex-col gap-1" data-testid="pet-spec-picker">
			<div className="talent-tree-header p-3 flex items-center text-white bg-transparent text-base z-1 border-b border-b-border">
				<span className="talent-tree-title mr-3 flex-1 font-bold whitespace-nowrap">Pet Spec</span>
			</div>
			<div className="talent-tree-main pet-spec-list flex flex-wrap gap-1 my-(--spacing-stack) mx-0 z-1 max-md:flex-col md:flex-row">
				{SPECS.map(({ spec, label, iconKey }) => (
					<div
						key={spec}
						className={clsx(
							'talent-picker-root pet-spec-item flex items-center gap-2 p-2 border-2 rounded-sm cursor-pointer transition-[border-color,background-color] duration-150 [transition-timing-function:ease] hover:bg-[rgb(255_255_255/0.05)]',
							spec === active ? 'selected border-talent-full bg-[rgb(0_0_0/0.2)]' : 'border-transparent',
						)}
						data-testid="pet-spec-item"
						data-selected={spec === active ? '' : undefined}
						{...tooltipAnchorProps(`${id}-${spec}`)}
						onClick={() => select(spec)}>
						<div
							className={clsx(
								'talent-picker-icon relative inline-block size-10 rounded-sm bg-no-repeat bg-cover bg-center cursor-pointer border',
								spec === active ? 'border-talent-full' : 'border-gray-600',
							)}
							style={{ backgroundImage: `url('https://wow.zamimg.com/images/wow/icons/large/${iconKey}.jpg')` }}
						/>
						<div className="talent-picker-label text-(length:--btn-font-size) text-white">{label}</div>
						<Tooltip id={`${id}-${spec}`} content={label} />
					</div>
				))}
			</div>
		</div>
	);
};
