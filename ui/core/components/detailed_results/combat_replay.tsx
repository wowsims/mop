import clsx from 'clsx';
import { ref } from 'tsx-vanilla';

import { OtherAction } from '../../proto/common';
import { ResourceType } from '../../proto/spell';
import { ActionId } from '../../proto_utils/action_id';
import { CastBeganLog, DamageDealtLog, Entity, ResourceChangedLog } from '../../proto_utils/logs_parser';
import { resourceColors, resourceNames } from '../../proto_utils/names';
import { SimResult, SimResultFilter } from '../../proto_utils/sim_result';
import i18n from '../../../i18n/config';
import { ResultComponent, ResultComponentConfig, SimResultData } from './result_component';

interface ReplayAction {
	time: number;
	name: string;
	iconUrl: string;
	actionId: ActionId | null;
	dmg: number | null;
	isCrit: boolean;
	target: Entity | null;
}

interface AuraSnapshot {
	gainedAt: number;
	fadedAt: number;
	name: string;
	iconUrl: string;
	actionId: ActionId | null;
	targetIndex: number;
}

interface ResourceSnapshot {
	time: number;
	type: ResourceType;
	value: number;
	maxValue: number;
}

interface HitEffect {
	time: number;
	targetIndex: number;
	x: number;
	y: number;
	dmg: number | null;
	isCrit: boolean;
}

interface EnemyCardDom {
	hpFill: HTMLElement;
	hpText: HTMLElement;
	debuffRow: HTMLElement;
	hitLayer: HTMLElement;
}

const BOSS_IMAGE_URL = '/mop/assets/img/boss_patchwerk.webp';

const RESOURCE_MAX_DEFAULTS: Partial<Record<ResourceType, number>> = {
	[ResourceType.ResourceTypeMana]: 100,
	[ResourceType.ResourceTypeEnergy]: 100,
	[ResourceType.ResourceTypeRage]: 100,
	[ResourceType.ResourceTypeComboPoints]: 5,
	[ResourceType.ResourceTypeFocus]: 100,
	[ResourceType.ResourceTypeRunicPower]: 100,
	[ResourceType.ResourceTypeChi]: 5,
	[ResourceType.ResourceTypeBloodRune]: 1,
	[ResourceType.ResourceTypeFrostRune]: 1,
	[ResourceType.ResourceTypeUnholyRune]: 1,
	[ResourceType.ResourceTypeDeathRune]: 1,
};

const RESOURCE_PRIORITY = [
	ResourceType.ResourceTypeMana,
	ResourceType.ResourceTypeEnergy,
	ResourceType.ResourceTypeComboPoints,
	ResourceType.ResourceTypeRage,
	ResourceType.ResourceTypeFocus,
	ResourceType.ResourceTypeRunicPower,
	ResourceType.ResourceTypeChi,
] as const;

const DOT_RESOURCE_TYPES = new Set([
	ResourceType.ResourceTypeComboPoints,
	ResourceType.ResourceTypeChi,
	ResourceType.ResourceTypeBloodRune,
	ResourceType.ResourceTypeFrostRune,
	ResourceType.ResourceTypeUnholyRune,
	ResourceType.ResourceTypeDeathRune,
]);

const HIT_WINDOW_SEC = 0.45;
const DMG_WINDOW_SEC = 1.1;
const MAX_TICKER = 10;
const MAX_ENEMIES = 8;

export class CombatReplay extends ResultComponent {
	private actions: ReplayAction[] = [];
	private resources: ResourceSnapshot[] = [];
	private hitEffects: HitEffect[] = [];
	private playerAuras: AuraSnapshot[] = [];
	private targetAuras: AuraSnapshot[] = [];
	private enemyNames: string[] = [];
	private filteredTargetEncounterIndices: number[] = [];
	private numEnemies = 1;
	private fightLen = 0;

	private currentTime = 0;
	private isPlaying = false;
	private playRate = 1;
	private rafId: number | null = null;
	private lastRaf: number | null = null;

	private lastBuffKey = '';
	private lastDebuffKeys = new Map<number, string>();

	/** Resource types present anywhere in the log — rows are pre-built so CDM height does not jump. */
	private lockedResourceTypes: ResourceType[] = [];
	private resourceMaxByType = new Map<ResourceType, number>();

	private readonly preloadedUrls = new Set<string>();
	private enemyCardDom: EnemyCardDom[] = [];
	private readonly actionIconByKey = new Map<string, HTMLAnchorElement>();

	private ui!: {
		emptyEl: HTMLElement;
		scene: HTMLElement;
		tickerTrack: HTMLElement;
		enemyZone: HTMLElement;
		enemyFormation: HTMLElement;
		buffIconsEl: HTMLElement;
		playerLabel: HTMLElement;
		castBarFill: HTMLElement;
		castBarLabel: HTMLElement;
		castBarTime: HTMLElement;
		resourceBarsEl: HTMLElement;
		actionGridEl: HTMLElement;
		scrubber: HTMLInputElement;
		timeDisplay: HTMLElement;
		playBtn: HTMLButtonElement;
		playIcon: HTMLElement;
		speedBtns: HTMLButtonElement[];
	};

	constructor(config: ResultComponentConfig) {
		config.rootCssClass = 'combat-replay-root';
		super(config);
		this.buildUI();
	}

	private buildUI(): void {
		const emptyRef = ref<HTMLDivElement>();
		const sceneRef = ref<HTMLDivElement>();
		const tickerTrackRef = ref<HTMLDivElement>();
		const enemyZoneRef = ref<HTMLDivElement>();
		const enemyFormationRef = ref<HTMLDivElement>();
		const buffIconsRef = ref<HTMLDivElement>();
		const playerLabelRef = ref<HTMLDivElement>();
		const castBarFillRef = ref<HTMLDivElement>();
		const castBarLabelRef = ref<HTMLDivElement>();
		const castBarTimeRef = ref<HTMLDivElement>();
		const resourceBarsRef = ref<HTMLDivElement>();
		const actionGridRef = ref<HTMLDivElement>();
		const scrubberRef = ref<HTMLInputElement>();
		const timeDisplayRef = ref<HTMLSpanElement>();
		const playBtnRef = ref<HTMLButtonElement>();
		const playIconRef = ref<HTMLElement>();

		this.rootElem.appendChild(
			<>
				<div ref={emptyRef} className="cr-empty">
					<div className="cr-empty-icon">⚔</div>
					<div className="cr-empty-title">{i18n.t('combat_replay.empty_title')}</div>
					<div className="cr-empty-desc">{i18n.t('combat_replay.empty_desc')}</div>
				</div>
				<div ref={sceneRef} className="cr-scene" style="display:none">
					<div className="cr-scene-vignette" aria-hidden="true" />
					<div className="cr-arena">
						<div className="cr-ticker-outer">
							<div ref={tickerTrackRef} className="cr-ticker-track" />
						</div>
						<div ref={enemyZoneRef} className="cr-enemy-zone">
							<div ref={enemyFormationRef} className="cr-enemy-formation" />
						</div>
					</div>
					<div className="cr-cdm">
						<div className="cr-cdm-header">
							<div ref={playerLabelRef} className="cr-cdm-player-label" />
							<div ref={buffIconsRef} className="cr-buff-icons" />
						</div>
						<div className="cr-cast-bar-container">
							<div ref={castBarFillRef} className="cr-cast-bar-fill" />
							<div ref={castBarLabelRef} className="cr-cast-bar-label" />
							<div ref={castBarTimeRef} className="cr-cast-bar-time" />
						</div>
						<div ref={resourceBarsRef} className="cr-resource-bars" />
						<div ref={actionGridRef} className="cr-action-grid" />
					</div>
					<div className="cr-controls">
						<div className="cr-ctrl-row">
							<button className="cr-ctrl-btn" dataset={{ seek: '-5' }} title={i18n.t('combat_replay.seek_back', { time: 5 })}>
								⏪
							</button>
							<button className="cr-ctrl-btn" dataset={{ seek: '-1' }} title={i18n.t('combat_replay.seek_back', { time: 1 })}>
								◀
							</button>
							<button ref={playBtnRef} type="button" className="cr-play-btn cr-ctrl-btn" title="Play / Pause">
								<i ref={playIconRef} className="fas fa-play" aria-hidden="true" />
							</button>
							<button className="cr-ctrl-btn" dataset={{ seek: '1' }} title={i18n.t('combat_replay.seek_fwd', { time: 1 })}>
								▶
							</button>
							<button className="cr-ctrl-btn" dataset={{ seek: '5' }} title={i18n.t('combat_replay.seek_fwd', { time: 5 })}>
								⏩
							</button>
							<div className="cr-speed-btns">
								<button className="cr-speed-btn active" dataset={{ rate: '1' }}>
									1x
								</button>
								<button className="cr-speed-btn" dataset={{ rate: '2' }}>
									2x
								</button>
								<button className="cr-speed-btn" dataset={{ rate: '3' }}>
									3x
								</button>
							</div>
							<span ref={timeDisplayRef} className="cr-time-display">
								0:00.0 / 0:00.0
							</span>
						</div>
						<div className="cr-scrub-row">
							<input ref={scrubberRef} type="range" className="cr-scrubber" min="0" max="1000" value="0" step="1" />
						</div>
					</div>
				</div>
			</>,
		);

		this.ui = {
			emptyEl: emptyRef.value!,
			scene: sceneRef.value!,
			tickerTrack: tickerTrackRef.value!,
			enemyZone: enemyZoneRef.value!,
			enemyFormation: enemyFormationRef.value!,
			buffIconsEl: buffIconsRef.value!,
			playerLabel: playerLabelRef.value!,
			castBarFill: castBarFillRef.value!,
			castBarLabel: castBarLabelRef.value!,
			castBarTime: castBarTimeRef.value!,
			resourceBarsEl: resourceBarsRef.value!,
			actionGridEl: actionGridRef.value!,
			scrubber: scrubberRef.value!,
			timeDisplay: timeDisplayRef.value!,
			playBtn: playBtnRef.value!,
			playIcon: playIconRef.value!,
			speedBtns: Array.from(this.rootElem.querySelectorAll<HTMLButtonElement>('.cr-speed-btn')),
		};

		this.bindEvents();
	}

	private bindEvents(): void {
		this.ui.playBtn.addEventListener('click', () => {
			if (this.isPlaying) this.pause();
			else this.play();
		});

		this.ui.scrubber.addEventListener('mousedown', () => this.pause());
		this.ui.scrubber.addEventListener('input', () => {
			const t = (parseInt(this.ui.scrubber.value) / 1000) * this.fightLen;
			this.seekTo(t);
		});

		this.rootElem.querySelectorAll<HTMLButtonElement>('.cr-ctrl-btn[data-seek]').forEach(btn => {
			const delta = parseFloat(btn.dataset['seek']!);
			btn.addEventListener('click', () => this.seekTo(this.currentTime + delta));
		});

		this.ui.speedBtns.forEach(btn => {
			btn.addEventListener('click', () => {
				this.playRate = parseFloat(btn.dataset['rate']!);
				this.ui.speedBtns.forEach(b => b.classList.toggle('active', b === btn));
			});
		});
	}

	onSimResult(resultData: SimResultData): void {
		this.stopPlayback();
		this.lastBuffKey = '';
		this.lastDebuffKeys.clear();
		this.actionIconByKey.clear();
		this.enemyCardDom = [];
		this.parseResult(resultData.result, resultData.filter);
		this.buildScene(resultData.result, resultData.filter);
		this.ui.emptyEl.style.display = 'none';
		this.ui.scene.style.display = 'flex';
		this.seekTo(0);
	}

	private parseResult(result: SimResult, filter: SimResultFilter): void {
		this.fightLen = result.result.firstIterationDuration || result.result.avgIterationDuration || 120;
		this.actions = [];
		this.resources = [];
		this.hitEffects = [];
		this.playerAuras = [];
		this.targetAuras = [];
		this.lockedResourceTypes = [];
		this.resourceMaxByType.clear();

		const filteredTargets = result.getTargets(filter);
		this.enemyNames = filteredTargets.map(t => t.name);
		this.filteredTargetEncounterIndices = filteredTargets.map(t => t.index);
		this.numEnemies = Math.max(1, filteredTargets.length);

		const players = result.getPlayers(filter);
		const playerEntity = players[0] ? new Entity(players[0].name, '', players[0].index, false, false) : null;
		const actionMetrics = result.getActionMetrics(filter);

		const castBeganLogs: CastBeganLog[] = [];
		const dmgLogs: DamageDealtLog[] = [];
		const resourceLogs: ResourceChangedLog[] = [];

		for (const log of result.logs) {
			if (log.timestamp < 0) continue;
			if (log.isCastBegan()) castBeganLogs.push(log);
			else if (log.isDamageDealt()) dmgLogs.push(log);
			else if (log.isResourceChanged()) resourceLogs.push(log);
		}

		const isReplayCastSequenceAction = (c: CastBeganLog): boolean => {
			const id = c.actionId;
			if (!id) return false;
			if (id.otherId !== OtherAction.OtherActionNone) return false;
			if (!id.spellId && !id.itemId) return false;
			if (!(id.name ?? '')) return false;
			if (actionMetrics.find(m => m.actionId?.equals(id))?.isPassiveAction) {
				return false;
			}
			return true;
		};

		const playerCasts = (playerEntity ? castBeganLogs.filter(c => c.source?.equals(playerEntity)) : castBeganLogs).filter(isReplayCastSequenceAction);
		const playerDmg = playerEntity ? dmgLogs.filter(d => d.source?.equals(playerEntity)) : dmgLogs;

		for (const cast of playerCasts) {
			if (!cast.actionId) continue;
			const castName = cast.actionId.name;
			const iconUrl = cast.actionId.iconUrl;
			const actionId = cast.actionId;

			let dmg: number | null = null;
			let isCrit = false;
			let target: Entity | null = null;

			for (const d of playerDmg) {
				if (d.timestamp < cast.timestamp) continue;
				if (d.timestamp > cast.timestamp + 3) break;
				if (d.actionId?.name === castName && !d.miss && !d.dodge && !d.parry) {
					dmg = d.amount;
					isCrit = d.crit;
					target = d.target;
					break;
				}
			}

			this.actions.push({ time: cast.timestamp, name: castName, iconUrl, actionId, dmg, isCrit, target });
		}

		const playerResourceLogs = playerEntity ? resourceLogs.filter(r => r.source?.equals(playerEntity)) : resourceLogs;

		const resourceMaxes = new Map<ResourceType, number>();
		for (const r of playerResourceLogs) {
			if (r.total > 0) {
				const cur = resourceMaxes.get(r.resourceType) ?? 0;
				if (r.total > cur) resourceMaxes.set(r.resourceType, r.total);
			}
		}

		for (const r of playerResourceLogs) {
			const maxValue = resourceMaxes.get(r.resourceType) || RESOURCE_MAX_DEFAULTS[r.resourceType] || 100;
			this.resources.push({
				time: r.timestamp,
				type: r.resourceType,
				value: r.valueAfter,
				maxValue,
			});
		}

		this.resourceMaxByType = new Map(resourceMaxes);
		const locked = new Set<ResourceType>();
		for (const r of playerResourceLogs) {
			if (r.resourceType === ResourceType.ResourceTypeNone || r.resourceType === ResourceType.ResourceTypeHealth) continue;
			locked.add(r.resourceType);
		}
		this.lockedResourceTypes = [];
		for (const p of RESOURCE_PRIORITY) {
			if (locked.has(p)) this.lockedResourceTypes.push(p);
		}
		for (const rt of locked) {
			if (!this.lockedResourceTypes.includes(rt)) this.lockedResourceTypes.push(rt);
		}

		for (const d of playerDmg) {
			if (d.miss || d.dodge || d.parry) continue;
			if (d.actionId && d.actionId.otherId !== OtherAction.OtherActionNone) continue;
			const cardIdx = this.enemyNames.findIndex(n => n === d.target?.name);
			if (cardIdx === -1 && this.enemyNames.length > 0) continue;
			const seed = Math.round(Math.abs(d.timestamp) * 1000);
			this.hitEffects.push({
				time: d.timestamp,
				targetIndex: Math.max(0, cardIdx),
				x: 20 + ((seed * 23) % 60),
				y: 10 + ((seed * 37) % 60),
				dmg: d.amount > 0 ? d.amount : null,
				isCrit: d.crit,
			});
		}

		if (players[0]) {
			for (const aura of players[0].auraUptimeLogs) {
				const id = aura.actionId;
				if (!id || (!id.spellId && !id.itemId) || !(id.name ?? '')) continue;
				if (id.otherId !== OtherAction.OtherActionNone) continue;
				this.playerAuras.push({ gainedAt: aura.gainedAt, fadedAt: aura.fadedAt, name: id.name, iconUrl: id.iconUrl, actionId: id, targetIndex: -1 });
			}
		}

		for (let i = 0; i < filteredTargets.length; i++) {
			const target = filteredTargets[i];
			for (const aura of target.auraUptimeLogs) {
				const id = aura.actionId;
				if (!id || (!id.spellId && !id.itemId) || !(id.name ?? '')) continue;
				if (id.otherId !== OtherAction.OtherActionNone) continue;
				this.targetAuras.push({
					gainedAt: aura.gainedAt,
					fadedAt: aura.fadedAt,
					name: id.name,
					iconUrl: id.iconUrl,
					actionId: id,
					targetIndex: target.index,
				});
			}
		}

		this.preloadImages();
	}

	private preloadImages(): void {
		const allUrls = [...this.actions.map(a => a.iconUrl), ...this.playerAuras.map(a => a.iconUrl), ...this.targetAuras.map(a => a.iconUrl)];
		for (const url of allUrls) {
			if (!url || this.preloadedUrls.has(url)) continue;
			this.preloadedUrls.add(url);
			new Image().src = url;
		}
	}

	private buildScene(result: SimResult, filter: SimResultFilter): void {
		const players = result.getPlayers(filter);
		const playerName = players[0]?.name ?? i18n.t('combat_replay.default_player');
		this.ui.playerLabel.textContent = playerName;

		const seen = new Map<string, ReplayAction>();
		for (const a of this.actions) {
			if (!seen.has(a.name)) seen.set(a.name, a);
		}

		this.ui.actionGridEl.replaceChildren();
		for (const [, action] of seen) {
			const iconRef = ref<HTMLAnchorElement>();
			this.ui.actionGridEl.appendChild(<a ref={iconRef} className="cr-action-icon" dataset={{ key: action.name }} />);
			const el = iconRef.value!;
			if (action.actionId) {
				action.actionId.setBackgroundAndHref(el);
				action.actionId.setWowheadDataset(el);
			}
			this.actionIconByKey.set(action.name, el);
		}

		this.buildEnemyZone();

		this.ui.scrubber.max = '1000';
		this.ui.scrubber.value = '0';
		this.currentTime = 0;
	}

	private appendEnemyCard(targetIdx: number, xPct: number, isFront: boolean, cardW: number): void {
		const name = this.enemyNames[targetIdx] ?? i18n.t('combat_replay.training_dummy');
		const hpFillRef = ref<HTMLDivElement>();
		const hpTextRef = ref<HTMLSpanElement>();
		const debuffRowRef = ref<HTMLDivElement>();
		const hitLayerRef = ref<HTMLDivElement>();
		const scale = isFront ? 1 : 0.62;
		const bottom = isFront ? '0%' : '14%';
		const bright = isFront ? 1 : 0.6;
		const z = isFront ? 2 : 1;

		this.ui.enemyFormation.appendChild(
			<div
				className="cr-enemy-card"
				dataset={{ idx: String(targetIdx) }}
				style={{
					position: 'absolute',
					left: `${xPct}%`,
					bottom,
					width: `${cardW}%`,
					transform: `translateX(-50%) scale(${scale})`,
					transformOrigin: 'bottom center',
					zIndex: z,
					filter: `brightness(${bright})`,
				}}>
				<div className="cr-nameplate">
					<div className="cr-enemy-name">{name}</div>
					<div className="cr-hp-bar">
						<div ref={hpFillRef} className="cr-hp-fill" style={{ width: '100%' }} />
						<span ref={hpTextRef} className="cr-hp-text">
							100.0%
						</span>
					</div>
					<div ref={debuffRowRef} className="cr-debuff-row" />
				</div>
				<div className="cr-silhouette">
					<img src={BOSS_IMAGE_URL} alt={name} draggable={false} />
					<div ref={hitLayerRef} className="cr-hit-layer" />
				</div>
			</div>,
		);

		this.enemyCardDom[targetIdx] = {
			hpFill: hpFillRef.value!,
			hpText: hpTextRef.value!,
			debuffRow: debuffRowRef.value!,
			hitLayer: hitLayerRef.value!,
		};
	}

	private buildEnemyZone(): void {
		const n = Math.min(this.numEnemies, MAX_ENEMIES);
		this.enemyCardDom = [];
		const formation = this.ui.enemyFormation;
		formation.replaceChildren();

		const frontCount = n <= 2 ? n : n <= 5 ? Math.ceil(n / 2) : 3;
		const backCount = n - frontCount;

		const rowXs = (count: number, minX: number, maxX: number): number[] =>
			count === 1 ? [(minX + maxX) / 2] : Array.from({ length: count }, (_, i) => minX + (i / (count - 1)) * (maxX - minX));

		const frontXs = rowXs(frontCount, frontCount <= 2 ? 22 : 12, frontCount <= 2 ? 78 : 88);
		const backXs = backCount > 0 ? rowXs(backCount, 18, 82) : [];

		const cardW = n === 1 ? 55 : n <= 2 ? 40 : n <= 4 ? 30 : 26;

		backXs.forEach((x, j) => this.appendEnemyCard(frontCount + j, x, false, cardW));
		frontXs.forEach((x, j) => this.appendEnemyCard(j, x, true, cardW));

		if (this.numEnemies > MAX_ENEMIES) {
			this.ui.enemyFormation.appendChild(
				<div className="cr-enemy-more" style={{ position: 'absolute', right: '10px', bottom: '8px' }}>
					+{this.numEnemies - MAX_ENEMIES}
				</div>,
			);
		}
	}

	private syntheticResourceSnap(rt: ResourceType): ResourceSnapshot {
		return {
			time: -1,
			type: rt,
			value: 0,
			maxValue: this.resourceMaxByType.get(rt) ?? RESOURCE_MAX_DEFAULTS[rt] ?? 100,
		};
	}

	private seekTo(t: number): void {
		this.currentTime = Math.max(0, Math.min(t, this.fightLen));
		this.renderFrame();
	}

	private renderFrame(): void {
		const t = this.currentTime;

		this.ui.scrubber.value = String(Math.round((t / Math.max(this.fightLen, 0.001)) * 1000));
		this.ui.timeDisplay.textContent = `${this.formatReplayTime(t)} / ${this.formatReplayTime(this.fightLen)}`;

		let actionIdx = -1;
		for (let i = 0; i < this.actions.length; i++) {
			if (this.actions[i].time <= t) actionIdx = i;
			else break;
		}

		this.renderTicker(this.actions.filter(a => a.time <= t).slice(-MAX_TICKER));
		this.renderCastBar(actionIdx, t);
		this.renderResources(t);
		this.renderPlayerBuffs(t);
		this.renderActionHighlights(actionIdx, t);
		this.renderEnemies(t);
	}

	private renderTicker(casts: ReplayAction[]): void {
		const newKeys = casts.map(c => `${c.time}|${c.name}`);
		const existing = Array.from(this.ui.tickerTrack.children) as HTMLElement[];
		const existingKeys = existing.map(el => el.dataset['key'] ?? '');

		if (existingKeys.length === newKeys.length && existingKeys.every((k, i) => k === newKeys[i])) {
			existing.forEach((el, i) => {
				const isLatest = i === casts.length - 1;
				el.classList.toggle('cr-strip-icon-active', isLatest);
				el.style.opacity = String(isLatest ? 1 : 0.25 + 0.6 * (i / Math.max(1, casts.length - 1)));
			});
			return;
		}

		const newKeySet = new Set(newKeys);
		const reusable = new Map<string, HTMLElement>();
		for (const el of existing) {
			const key = el.dataset['key'] ?? '';
			if (newKeySet.has(key)) reusable.set(key, el);
		}

		const slots: HTMLElement[] = [];
		casts.forEach((cast, i) => {
			const key = `${cast.time}|${cast.name}`;
			const isLatest = i === casts.length - 1;

			let slot = reusable.get(key);
			if (!slot) {
				slot = document.createElement('a');
				slot.dataset['key'] = key;

				if (cast.actionId) {
					cast.actionId.setBackgroundAndHref(slot as HTMLAnchorElement);
					cast.actionId.setWowheadDataset(slot as HTMLAnchorElement);
				}

				if (cast.isCrit) {
					const badge = document.createElement('span');
					badge.className = 'cr-crit-badge';
					badge.textContent = '!';
					slot.appendChild(badge);
				}
				if (cast.dmg != null && cast.dmg > 0) {
					const badge = document.createElement('span');
					badge.className = 'cr-dmg-badge';
					badge.textContent = cast.dmg >= 1000 ? `${(cast.dmg / 1000).toFixed(1)}k` : String(Math.round(cast.dmg));
					slot.appendChild(badge);
				}
			}

			slot.className = 'cr-strip-icon' + (isLatest ? ' cr-strip-icon-active' : '');
			slot.style.opacity = String(isLatest ? 1 : 0.25 + 0.6 * (i / Math.max(1, casts.length - 1)));
			slots.push(slot);
		});

		this.ui.tickerTrack.replaceChildren(...slots);
	}

	private renderCastBar(actionIdx: number, t: number): void {
		if (actionIdx < 0) {
			this.ui.castBarFill.style.width = '0%';
			this.ui.castBarLabel.textContent = '';
			this.ui.castBarTime.textContent = '';
			return;
		}

		const currentAction = this.actions[actionIdx];
		let nextTime = this.fightLen;
		for (let i = actionIdx + 1; i < this.actions.length; i++) {
			nextTime = this.actions[i].time;
			break;
		}

		const castDur = nextTime - currentAction.time;
		if (castDur <= 1.5 || castDur > 10) {
			this.ui.castBarFill.style.width = '0%';
			this.ui.castBarLabel.textContent = '';
			this.ui.castBarTime.textContent = '';
			return;
		}

		const elapsed = t - currentAction.time;
		this.ui.castBarFill.style.width = `${Math.min(1, elapsed / castDur) * 100}%`;
		this.ui.castBarLabel.textContent = currentAction.name;
		this.ui.castBarTime.textContent = `${Math.max(0, castDur - elapsed).toFixed(1)}s`;
	}

	private renderDotResourceRow(_rt: ResourceType, snap: ResourceSnapshot, color: string, label: string): HTMLElement {
		const maxDots = Math.round(snap.maxValue);
		const filled = Math.round(snap.value);
		const segBarRef = ref<HTMLDivElement>();
		const root = (
			<div className="cr-resource-wrap cr-resource-dot">
				<span className="cr-dot-label">{label}</span>
				<div ref={segBarRef} className="cr-seg-bar" />
				<span className="cr-dot-val">
					{filled}/{maxDots}
				</span>
			</div>
		) as unknown as HTMLElement;
		const bar = segBarRef.value!;
		for (let i = 0; i < maxDots; i++) {
			const on = i < filled;
			bar.appendChild(
				(
					<div
						className={on ? 'cr-segment cr-segment--filled' : 'cr-segment cr-segment--empty'}
						style={
							on
								? {
										background: `linear-gradient(180deg,${color}ee,${color}99)`,
										boxShadow: `0 0 8px ${color}88`,
									}
								: {}
						}
					/>
				) as unknown as HTMLElement,
			);
		}
		return root;
	}

	private renderBarResourceRow(_rt: ResourceType, snap: ResourceSnapshot, color: string, label: string): HTMLElement {
		const pct = snap.maxValue > 0 ? Math.min(1, Math.max(0, snap.value / snap.maxValue)) : 0;
		return (
			<div className="cr-resource-wrap">
				<div className="cr-res-bar-outer">
					<div
						className="cr-res-bar-fill"
						style={{
							width: `${pct * 100}%`,
							background: `linear-gradient(90deg,${color}88,${color}dd)`,
							boxShadow: `0 0 10px ${color}55`,
						}}
					/>
					<span className="cr-bar-label">{label}</span>
					<span className="cr-bar-val">
						{Math.round(snap.value)}/{Math.round(snap.maxValue)}
					</span>
				</div>
			</div>
		) as unknown as HTMLElement;
	}

	private renderResources(t: number): void {
		if (this.lockedResourceTypes.length === 0) {
			this.ui.resourceBarsEl.replaceChildren();
			return;
		}

		const latest = new Map<ResourceType, ResourceSnapshot>();
		for (const snap of this.resources) {
			if (snap.time <= t) latest.set(snap.type, snap);
		}

		let primaryType: ResourceType | null = null;
		for (const p of RESOURCE_PRIORITY) {
			if (this.lockedResourceTypes.includes(p)) {
				primaryType = p;
				break;
			}
		}

		const orderedTypes = primaryType ? [primaryType, ...this.lockedResourceTypes.filter(rt => rt !== primaryType)] : [...this.lockedResourceTypes];

		const frag = document.createDocumentFragment();
		for (const rt of orderedTypes) {
			if (rt === ResourceType.ResourceTypeNone) continue;
			if (rt === ResourceType.ResourceTypeHealth) continue;
			const snap = latest.get(rt) ?? this.syntheticResourceSnap(rt);
			const color = resourceColors.get(rt) ?? '#94a3b8';
			const label = resourceNames.get(rt) ?? String(rt);
			const row = DOT_RESOURCE_TYPES.has(rt) ? this.renderDotResourceRow(rt, snap, color, label) : this.renderBarResourceRow(rt, snap, color, label);
			frag.appendChild(row);
		}
		this.ui.resourceBarsEl.replaceChildren(frag);
	}

	private renderActionHighlights(actionIdx: number, t: number): void {
		const recent = new Set<string>();
		for (let i = actionIdx; i >= 0 && i >= actionIdx - 5; i--) {
			const a = this.actions[i];
			if (!a || t - a.time > 0.6) break;
			recent.add(a.name);
		}
		for (const [key, el] of this.actionIconByKey) {
			el.classList.toggle('cr-action-icon-active', recent.has(key));
		}
	}

	private renderAuraIcons(container: HTMLElement, auras: AuraSnapshot[], t: number, cacheKey: string): string {
		const active = auras.filter(a => a.gainedAt <= t && a.fadedAt >= t);
		const key = active.map(a => a.name).join('|');
		if (key === cacheKey) return cacheKey;

		const frag = document.createDocumentFragment();
		for (const aura of active) {
			const iconRef = ref<HTMLAnchorElement>();
			frag.appendChild(<a ref={iconRef} className="cr-aura-icon" />);
			const el = iconRef.value!;
			if (aura.actionId) {
				aura.actionId.setBackgroundAndHref(el);
				aura.actionId.setWowheadDataset(el, { useBuffAura: true });
			}
		}
		container.replaceChildren(frag);
		return key;
	}

	private renderPlayerBuffs(t: number): void {
		this.lastBuffKey = this.renderAuraIcons(this.ui.buffIconsEl, this.playerAuras, t, this.lastBuffKey);
	}

	private renderTargetDebuffs(cardIdx: number, container: HTMLElement, t: number): void {
		const encounterIdx = this.filteredTargetEncounterIndices[cardIdx] ?? cardIdx;
		const debuffs = this.targetAuras.filter(a => a.targetIndex === encounterIdx);
		const prev = this.lastDebuffKeys.get(cardIdx) ?? '';
		const next = this.renderAuraIcons(container, debuffs, t, prev);
		this.lastDebuffKeys.set(cardIdx, next);
	}

	private makeHitEffectRoot(hit: HitEffect, t: number): HTMLElement {
		const age = t - hit.time;
		const p = Math.min(1, age / HIT_WINDOW_SEC);
		const ep = 1 - (1 - p) * (1 - p);
		const dp = Math.min(1, age / DMG_WINDOW_SEC);
		const flashSize = 14 + ep * 28;
		const ringSize = 24 + ep * 72;
		const alpha = Math.max(0, 1 - p);
		const ringAlpha = Math.max(0, (1 - p) * 0.85);
		const floatY = dp < 0.3 ? (dp / 0.3) * 28 : 28 + ((dp - 0.3) / 0.7) * 14;
		const numOpacity = dp < 0.15 ? dp / 0.15 : dp > 0.6 ? Math.max(0, 1 - (dp - 0.6) / 0.4) : 1;
		const numScale = dp < 0.1 ? 1.4 - (dp / 0.1) * 0.4 : 1;
		const ringGlow = 6 + ep * 10;
		const dmgStr =
			hit.dmg == null
				? ''
				: hit.dmg >= 1000000
					? `${(hit.dmg / 1000000).toFixed(2)}M`
					: hit.dmg >= 1000
						? `${(hit.dmg / 1000).toFixed(1)}K`
						: String(Math.round(hit.dmg));

		const ringClass = clsx('cr-hit-ring', hit.isCrit ? 'cr-hit-outcome-crit' : 'cr-hit-outcome-hit');

		return (
			<div className="cr-hit-effect" style={{ left: `${hit.x}%`, top: `${hit.y}%` }}>
				<div
					className="cr-hit-flash"
					style={{
						width: `${flashSize}px`,
						height: `${flashSize}px`,
						opacity: alpha * (hit.isCrit ? 1 : 0.85),
					}}
				/>
				<div
					className={ringClass}
					style={{
						width: `${ringSize}px`,
						height: `${ringSize}px`,
						opacity: ringAlpha,
						boxShadow: `0 0 ${ringGlow}px currentColor`,
					}}
				/>
				{hit.isCrit ? (
					<div
						className="cr-hit-ring cr-hit-outcome-crit-secondary"
						style={{
							width: `${ringSize * 1.6}px`,
							height: `${ringSize * 1.6}px`,
							opacity: ringAlpha * 0.5,
						}}
					/>
				) : null}
				{hit.dmg != null ? (
					<div
						className={clsx('cr-dmg-num', hit.isCrit && 'cr-dmg-crit')}
						style={{
							opacity: numOpacity,
							transform: `translate(-50%, calc(-50% - ${floatY}px)) scale(${numScale})`,
						}}>
						{dmgStr}
					</div>
				) : null}
			</div>
		) as unknown as HTMLElement;
	}

	private renderEnemies(t: number): void {
		const totalDmg: Record<number, number> = {};
		const cumDmg: Record<number, number> = {};

		for (const h of this.hitEffects) {
			const ti = h.targetIndex;
			totalDmg[ti] = (totalDmg[ti] ?? 0) + (h.dmg ?? 0);
			if (h.time <= t) cumDmg[ti] = (cumDmg[ti] ?? 0) + (h.dmg ?? 0);
		}

		const n = Math.min(this.numEnemies, MAX_ENEMIES);
		for (let i = 0; i < n; i++) {
			const dom = this.enemyCardDom[i];
			if (!dom) continue;

			const hpPct = Math.max(0, 1 - (cumDmg[i] ?? 0) / Math.max(1, totalDmg[i] ?? 1));
			dom.hpFill.style.width = `${hpPct * 100}%`;
			dom.hpText.textContent = `${(hpPct * 100).toFixed(1)}%`;

			this.renderTargetDebuffs(i, dom.debuffRow, t);

			const activeHits = this.hitEffects.filter(h => h.targetIndex === i && t - h.time >= 0 && t - h.time <= DMG_WINDOW_SEC);
			const hitFrag = document.createDocumentFragment();
			for (const hit of activeHits) {
				hitFrag.appendChild(this.makeHitEffectRoot(hit, t));
			}
			dom.hitLayer.replaceChildren(hitFrag);
		}
	}

	private syncPlayIcon(): void {
		this.ui.playIcon.className = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
	}

	private play(): void {
		if (this.isPlaying) return;
		if (this.currentTime >= this.fightLen) this.seekTo(0);
		this.isPlaying = true;
		this.lastRaf = null;
		this.syncPlayIcon();
		this.rafId = requestAnimationFrame(ts => this.tick(ts));
	}

	private pause(): void {
		if (!this.isPlaying) return;
		this.isPlaying = false;
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		this.syncPlayIcon();
	}

	private tick(ts: number): void {
		if (!this.isPlaying) return;
		if (this.lastRaf !== null) {
			const next = this.currentTime + ((ts - this.lastRaf) / 1000) * this.playRate;
			if (next >= this.fightLen) {
				this.seekTo(this.fightLen);
				this.pause();
				return;
			}
			this.seekTo(next);
		}
		this.lastRaf = ts;
		this.rafId = requestAnimationFrame(ts2 => this.tick(ts2));
	}

	stopPlayback(): void {
		this.pause();
		this.seekTo(0);
	}

	private formatReplayTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		return `${m}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
	}
}
