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
		<div data-testid="cr-scene" className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden bg-cr-scene">
			<div className="absolute inset-0 z-0 bg-cr-vignette pointer-events-none" aria-hidden="true" />
			<div className="relative z-1 min-h-45 flex-1 overflow-hidden bg-transparent">
				<div className="absolute inset-x-0 top-2.5 z-10 flex justify-center">
					<ReplayTicker actions={model.actions} />
				</div>
				<div className="absolute inset-x-5 bottom-0 top-[calc(var(--spacing-cr-icon)+20px)] z-1 overflow-hidden">
					<ReplayEnemyFormation enemies={model.enemies} hiddenCount={model.hiddenEnemyCount} />
				</div>
			</div>
			<div className="relative z-1 w-1/2 shrink-0 self-center bg-black-92 px-4 py-[8px] border-t border-white-8 flex flex-col gap-1.5">
				<div className="flex min-h-11.5 flex-nowrap items-center gap-[8px]">
					<div data-testid="cr-cdm-player-label" className="shrink-0 text-ep-delta font-bold tracking-[0.04em] text-white-70">
						{model.playerName}
					</div>
					<ReplayAuraIcons
						testId="cr-buff-icons"
						className="flex w-full min-w-0 flex-1 flex-row flex-wrap content-start justify-start gap-0.75 min-h-11.25 max-h-33 overflow-hidden"
						auras={model.playerAuras}
					/>
				</div>
				<ReplayCastBar actions={model.actions} duration={model.duration} />
				<ReplayResourceBars rows={model.resourceRows} />
				<ReplayActionGrid actions={model.actions} uniqueActions={model.uniqueActions} />
			</div>
			<ReplayControls clock={clock} />
		</div>
	</ReplayFramesContext>
);
