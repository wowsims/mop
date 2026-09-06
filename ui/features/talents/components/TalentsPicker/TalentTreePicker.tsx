import { PlayerSpecs } from '@domain/player_specs';
import type { TalentTreeConfig } from '@domain/talents/config';
import { usePlayer } from '@features/SimHostContext';
import i18n from '@i18n/config';
import { translatePlayerSpec } from '@i18n/localization';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { Tooltip } from '@ui-kit/Tooltip';
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

/**
 * The tree: the spec header with its reset button, the background, and the grid of talents.
 *
 * It was module-scoped and unexported in the vanilla file, which is why `pet_spec_picker` retyped
 * its markup *and* its class names to piggyback on this stylesheet. Exported here, but the class
 * names stay shared until those styles are deliberately split.
 */
export const TalentTreePicker = <TalentsProto,>({ config, talentsString, onChange }: TalentTreePickerProps<TalentsProto>) => {
	const player = usePlayer();
	const playerSpec = player.getSpec();
	const resetTooltipId = useId();
	const spec = useMemo(() => PlayerSpecs.fromProto(playerSpec), [playerSpec]);
	const rows = useMemo(() => buildTalentRows(config.talents), [config.talents]);

	return (
		<div className="talent-tree-picker-root">
			<div className="talent-tree-header">
				<img src={spec.getIcon('medium')} className="talent-tree-icon" />
				<span className="talent-tree-title">{translatePlayerSpec(spec)}</span>
				<Button
					variant={null}
					className="talent-tree-reset link-danger"
					data-tooltip-id={resetTooltipId}
					onClick={() => onChange(clearedTalentsString())}>
					{/* `style="base"` keeps the bare `fa` prefix: the class list is what the pane parity
					    gate compares, and normalising this glyph to `fas` is a change, not a port. */}
					<Icon name="times" style="base" />
				</Button>
				<Tooltip id={resetTooltipId} content={i18n.t('talents_tab.reset_button.tooltip')} />
			</div>
			<div className="talent-tree-background" style={{ backgroundImage: `url('${config.backgroundUrl}')` }} />
			<div className="talent-tree-main">
				{rows.map((row, rowIdx) => (
					<div className="talent-tree-row" key={rowIdx}>
						<div className="talent-tree-level">{(rowIdx + 1) * LEVELS_PER_ROW}</div>
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
