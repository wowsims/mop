import type { ReplayClock } from '../../hooks/useReplayClock';
import { ReplayFramesContext } from '../../hooks/useReplayFrame';
import type { ReplayModel } from '../../model/replay';
import { ReplayEnemyFormation } from './arena/ReplayEnemyFormation';
import { ReplayTicker } from './arena/ReplayTicker';
import { ReplayControls } from './controls/ReplayControls';
import { ReplayActionGrid } from './hud/ReplayActionGrid';
import { ReplayAuraIcons } from './hud/ReplayAuraIcons';
import { ReplayCastBar } from './hud/ReplayCastBar';
import { ReplayResourceBars } from './hud/ReplayResourceBars';

export interface ReplaySceneProps {
	model: ReplayModel;
	clock: ReplayClock;
}

/** Everything below here reads the playhead out of the context rather than out of a prop that changes. */
export const ReplayScene = ({ model, clock }: ReplaySceneProps) => (
	<ReplayFramesContext value={clock.frames}>
		<div className="cr-scene">
			<div className="cr-scene-vignette" aria-hidden="true" />
			<div className="cr-arena">
				<div className="cr-ticker-outer">
					<ReplayTicker actions={model.actions} />
				</div>
				<div className="cr-enemy-zone">
					<ReplayEnemyFormation enemies={model.enemies} hiddenCount={model.hiddenEnemyCount} />
				</div>
			</div>
			<div className="cr-cdm">
				<div className="cr-cdm-header">
					<div className="cr-cdm-player-label">{model.playerName}</div>
					<ReplayAuraIcons className="cr-buff-icons" auras={model.playerAuras} />
				</div>
				<ReplayCastBar actions={model.actions} duration={model.duration} />
				<ReplayResourceBars rows={model.resourceRows} />
				<ReplayActionGrid actions={model.actions} uniqueActions={model.uniqueActions} />
			</div>
			<ReplayControls clock={clock} />
		</div>
	</ReplayFramesContext>
);
