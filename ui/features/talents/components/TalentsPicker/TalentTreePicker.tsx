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
		<div className="relative flex flex-1 flex-col border border-border not-first:-ml-px">
			<div className="z-1 flex items-center bg-black p-3 text-base text-white">
				<img src={spec.getIcon('medium')} className="mr-3 size-8 rounded-full" />
				<span className="mr-3 flex-1 font-bold whitespace-nowrap">{translatePlayerSpec(spec)}</span>
				<Button
					variant={null}
					className="-mr-3 leading-none text-link-danger"
					data-testid="talent-tree-reset"
					{...tooltipAnchorProps(resetTooltipId)}
					onClick={() => onChange(clearedTalentsString())}>
					<Icon name="times" style="base" />
				</Button>
				<Tooltip id={resetTooltipId} content={i18n.t('talents_tab.reset_button.tooltip')} />
			</div>
			<div
				className="absolute top-14 right-0 bottom-0 left-0 z-0 bg-size-[100%_100%] bg-no-repeat shadow-talent-tree"
				style={{ backgroundImage: `url('${config.backgroundUrl}')` }}
			/>
			<div className="z-1 mx-[2vw] my-3 max-xxxl:mx-auto max-lg:mx-10" data-testid="talent-tree-main">
				{rows.map((row, rowIdx) => (
					<div className="grid grid-cols-icon-triple has-data-[selected='true']:[&>a:not([data-selected='true'])]:grayscale" key={rowIdx}>
						<div className="content-center justify-self-center p-2" data-testid="talent-tree-level">
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
