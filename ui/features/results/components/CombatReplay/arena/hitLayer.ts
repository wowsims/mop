import type { ReplayHit } from '../../../model/replay';
import { hitDamageLabel, hitFrame } from '../../../model/replay';

interface HitNodes {
	root: HTMLElement;
	flash: HTMLElement;
	ring: HTMLElement;
	/** Crits get a second, wider ring; everything else has one. */
	secondary: HTMLElement | null;
	number: HTMLElement | null;
}

export type HitNodeCache = Map<ReplayHit, HitNodes>;

const div = (className: string): HTMLElement => {
	const element = document.createElement('div');
	element.className = className;
	return element;
};

const createHitNodes = (hit: ReplayHit): HitNodes => {
	const root = div('cr-hit-effect');
	root.style.left = `${hit.x}%`;
	root.style.top = `${hit.y}%`;

	const flash = div('cr-hit-flash');
	const ring = div(`cr-hit-ring ${hit.isCrit ? 'cr-hit-outcome-crit' : 'cr-hit-outcome-hit'}`);
	root.append(flash, ring);

	const secondary = hit.isCrit ? div('cr-hit-ring cr-hit-outcome-crit-secondary') : null;
	if (secondary) root.append(secondary);

	const number = hit.dmg == null ? null : div(hit.isCrit ? 'cr-dmg-num cr-dmg-crit' : 'cr-dmg-num');
	if (number) {
		number.textContent = hitDamageLabel(hit.dmg!);
		root.append(number);
	}

	return { root, flash, ring, secondary, number };
};

const paintHit = (nodes: HitNodes, hit: ReplayHit, time: number) => {
	const frame = hitFrame(hit, time);

	nodes.flash.style.width = `${frame.flashSize}px`;
	nodes.flash.style.height = `${frame.flashSize}px`;
	nodes.flash.style.opacity = String(frame.flashOpacity);

	nodes.ring.style.width = `${frame.ringSize}px`;
	nodes.ring.style.height = `${frame.ringSize}px`;
	nodes.ring.style.opacity = String(frame.ringOpacity);
	nodes.ring.style.boxShadow = `0 0 ${frame.ringGlow}px currentColor`;

	if (nodes.secondary) {
		nodes.secondary.style.width = `${frame.ringSize * 1.6}px`;
		nodes.secondary.style.height = `${frame.ringSize * 1.6}px`;
		nodes.secondary.style.opacity = String(frame.ringOpacity * 0.5);
	}

	if (nodes.number) {
		nodes.number.style.opacity = String(frame.numberOpacity);
		nodes.number.style.transform = `translate(-50%, calc(-50% - ${frame.floatY}px)) scale(${frame.numberScale})`;
	}
};

/**
 * The impact animation, kept out of React on purpose: every live hit's size, opacity and offset change
 * on every one of sixty frames a second, and the nodes are pooled by hit so a frame is a handful of
 * style writes rather than a rebuilt subtree.
 */
export const paintHitLayer = (container: HTMLElement, cache: HitNodeCache, hits: ReadonlyArray<ReplayHit>, time: number) => {
	const live = new Set(hits);
	for (const [hit, nodes] of cache) {
		if (live.has(hit)) continue;
		nodes.root.remove();
		cache.delete(hit);
	}

	hits.forEach((hit, index) => {
		let nodes = cache.get(hit);
		if (!nodes) {
			nodes = createHitNodes(hit);
			cache.set(hit, nodes);
		}
		// Seeking backwards brings older hits in at the front, so position is checked rather than appended.
		if (container.children[index] !== nodes.root) container.insertBefore(nodes.root, container.children[index] ?? null);
		paintHit(nodes, hit, time);
	});
};
