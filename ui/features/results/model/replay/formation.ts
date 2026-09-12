export interface ReplayCardLayout {
	/** Index into the enemy list — not the position on screen, which is where the card appears in the array. */
	index: number;
	xPct: number;
	widthPct: number;
	scale: number;
}

const widthPct = (count: number): number => (count === 1 ? 55 : count <= 2 ? 40 : count <= 4 ? 30 : count <= 6 ? 26 : 22);

const spread = (count: number): [number, number] => (count <= 2 ? [25, 75] : count <= 4 ? [15, 85] : [10, 90]);

/**
 * Places `count` enemy cards left to right around a centre, innermost first:
 *
 *     odd  count: [… 6, 4, 2, 0, 1, 3, 5 …]
 *     even count: [… 6, 4, 2, 0, 1, 3, 5, 7 …]
 *
 * Enemy 0 — the user's "1" — is always innermost, and the pair 0/1 shares the centre when the count
 * is even. Cards further out are pushed back with a smaller scale, so the formation reads as depth.
 */
export const enemyFormation = (count: number): ReplayCardLayout[] => {
	const left: number[] = [];
	for (let i = 2; i < count; i += 2) left.push(i);

	// For an even count index 1 is in the centre pair, so the right-hand side starts at 3.
	const right: number[] = [];
	for (let i = count % 2 === 0 ? 3 : 1; i < count; i += 2) right.push(i);

	const centre = count % 2 === 0 ? [0, 1] : [0];
	const slots = [
		...[...left].reverse().map((index, at) => ({ index, depth: left.length - at })),
		...centre.map(index => ({ index, depth: 0 })),
		...right.map((index, at) => ({ index, depth: at + 1 })),
	];

	const maxDepth = slots.reduce((deepest, slot) => Math.max(deepest, slot.depth), 0);
	const scaleStep = maxDepth > 0 ? (1 - (count >= 6 ? 0.25 : 0.5)) / maxDepth : 0;
	const [xMin, xMax] = spread(count);
	const width = widthPct(count);

	return slots.map((slot, at) => ({
		index: slot.index,
		xPct: slots.length <= 1 ? 50 : xMin + (at / (slots.length - 1)) * (xMax - xMin),
		widthPct: width,
		scale: 1 - slot.depth * scaleStep,
	}));
};
