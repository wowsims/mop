import i18n from '@i18n/config';
import { translatePlayerSpec } from '@i18n/localization';
import { usePlayer } from '@sim/context/SimHostContext';
import { PlayerSpecs } from '@sim/player/specs';
import type { TalentTreeConfig } from '@sim/talents/config';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useId, useMemo } from 'react';

import { TalentPicker } from './TalentPicker';
import { buildTalentRows } from './utils/rows';
import { clearedTalentsString } from './utils/talents_string';

export interface TalentTreePickerProps<TalentsProto> {
	config: TalentTreeConfig<TalentsProto>;
	talentsString: string;
	onChange: (next: string) => void;
}

/** Row N is unlocked at level N × 15, which is what the gutter shows. */
const LEVELS_PER_ROW = 15;

export const TalentTreePicker = <TalentsProto,>({ config, talentsString, onChange }: TalentTreePickerProps<TalentsProto>) => {
	const player = usePlayer();
	const playerSpec = player.getSpec();
	const resetTooltipId = useId();
	const spec = useMemo(() => PlayerSpecs.fromProto(playerSpec), [playerSpec]);
	const rows = useMemo(() => buildTalentRows(config.talents), [config.talents]);

	return (
		<div className="relative border border-border flex flex-col flex-1 not-first:-ml-px">
			<div className="p-3 flex items-center text-white bg-black text-base z-1">
				<img src={spec.getIcon('medium')} className="size-8 mr-3 rounded-full" />
				<span className="mr-3 flex-1 font-bold whitespace-nowrap">{translatePlayerSpec(spec)}</span>
				<Button
					variant={null}
					className="leading-none text-link-danger -mr-3"
					data-testid="talent-tree-reset"
					{...tooltipAnchorProps(resetTooltipId)}
					onClick={() => onChange(clearedTalentsString())}>
					<Icon name="times" style="base" />
				</Button>
				<Tooltip id={resetTooltipId} content={i18n.t('talents_tab.reset_button.tooltip')} />
			</div>
			<div
				className="absolute top-14 right-0 bottom-0 left-0 bg-no-repeat bg-[length:100%_100%] shadow-talent-tree z-0"
				style={{ backgroundImage: `url('${config.backgroundUrl}')` }}
			/>
			<div className="my-3 mx-[2vw] z-1 max-xxxl:mx-auto max-lg:mx-10" data-testid="talent-tree-main">
				{rows.map((row, rowIdx) => (
					<div className="grid grid-cols-icon-triple has-[[data-selected='true']]:[&>a:not([data-selected='true'])]:grayscale" key={rowIdx}>
						<div className="p-2 content-center justify-self-center" data-testid="talent-tree-level">
							{(rowIdx + 1) * LEVELS_PER_ROW}
						</div>
						{row.map(talent => (
							<TalentPicker
								key={`${talent.location.rowIdx}-${talent.location.colIdx}`}
								config={talent}
								talentsString={talentsString}
								onChange={onChange}
							/>
						))}
					</div>
				))}
			</div>
		</div>
	);
};
