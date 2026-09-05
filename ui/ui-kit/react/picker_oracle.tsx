import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';

export interface VanillaPicker {
	rootElem: HTMLElement;
	dispose(): void;
}

export interface PickerPair<ModObject> {
	vanilla: { modObject: ModObject; rootElem: HTMLElement };
	react: { modObject: ModObject; rootElem: Element };
	/** Differing lines whose classes do not match even when sorted — the ones that matter. */
	diff(): string[];
	/** Every differing line, each tagged REAL or CLASS-ORDER. */
	allDiffs(): string[];
	/** Applies the same change to both mod objects and settles React. */
	step(mutate: (modObject: ModObject) => void): Promise<void>;
	dispose(): void;
}

const serialize = (element: Element, depth = 0): string[] => {
	const attributes = Array.from(element.attributes)
		.map(attribute => `${attribute.name}="${attribute.value}"`)
		.sort()
		.join(' ');
	const background = (element as HTMLElement).style?.backgroundImage ?? '';
	const text = Array.from(element.childNodes)
		.filter(node => node.nodeType === Node.TEXT_NODE)
		.map(node => node.textContent)
		.join('');
	const line = `${'  '.repeat(depth)}<${element.tagName.toLowerCase()} ${attributes}> bg=[${background}] text=[${text}] hidden=${(element as HTMLElement).hidden}`;
	return [line, ...Array.from(element.children).flatMap(child => serialize(child, depth + 1))];
};

const withSortedClasses = (line = '') =>
	line.replace(/class="([^"]*)"/, (_match, classes: string) => `class="${classes.trim().split(/\s+/).sort().join(' ')}"`);

const compare = (vanilla: string[], react: string[]) =>
	Array.from({ length: Math.max(vanilla.length, react.length) }, (_unused, index) => index)
		.filter(index => vanilla[index] !== react[index])
		.map(index => {
			const kind = withSortedClasses(vanilla[index]) === withSortedClasses(react[index]) ? 'CLASS-ORDER' : 'REAL';
			return `line ${index} [${kind}]:\n  vanilla: ${vanilla[index]}\n  react:   ${react[index]}`;
		});

/**
 * Mounts a vanilla picker and its React port over equivalent mod objects and diffs the two trees,
 * element by element and attribute by attribute. This is what check 1 in the skill means: a port
 * that reads right can still drop an element the stylesheet hides, and only the diff finds it.
 *
 * Two things the caller has to get right, both of which cost an afternoon when missed:
 * - The vanilla picker is attached to `document.body`, because `Input`'s source listener disposes
 *   the picker when `existsInDOM` says its element is detached — a detached one dies on the first
 *   notification and every later comparison is against a corpse.
 * - The fixture's setter must drop equal writes, like the real facades do (`Player.setBuffs`
 *   returns early on `equals`). Vanilla's `restoreValue` notifies before it clears its stored
 *   value, so without that guard it re-enters itself without bound.
 */
export async function mountBoth<ModObject, Config>({
	Vanilla,
	React,
	config,
	makeModObject,
}: {
	Vanilla: new (parent: HTMLElement, modObject: ModObject, config: Config) => VanillaPicker;
	React: (props: { modObject: ModObject; config: Config }) => ReactNode;
	config: Config;
	makeModObject: () => ModObject;
}): Promise<PickerPair<ModObject>> {
	const vanillaModObject = makeModObject();
	const parent = document.createElement('div');
	document.body.appendChild(parent);
	const vanilla = new Vanilla(parent, vanillaModObject, config);
	// Anything the picker fills asynchronously — an ActionId icon, a tooltip dataset — lands here.
	await act(async () => {});

	const reactModObject = makeModObject();
	const { container, unmount } = render(<React modObject={reactModObject} config={config} />);

	const allDiffs = () => compare(serialize(vanilla.rootElem), serialize(container.firstElementChild!));

	return {
		vanilla: { modObject: vanillaModObject, rootElem: vanilla.rootElem },
		react: { modObject: reactModObject, rootElem: container.firstElementChild! },
		allDiffs,
		diff: () => allDiffs().filter(line => line.includes('[REAL]')),
		step: async mutate => {
			await act(async () => {
				mutate(vanillaModObject);
				mutate(reactModObject);
			});
		},
		dispose: () => {
			vanilla.dispose();
			parent.remove();
			unmount();
		},
	};
}
