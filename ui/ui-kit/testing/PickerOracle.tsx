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
	/** Label and description actually reach the control — what the diff stops checking. */
	associations(): string[];
	/** Applies the same change to both mod objects and settles React. */
	step(mutate: (modObject: ModObject) => void): Promise<void>;
	dispose(): void;
}

// What a field shows lives in an IDL property that never reflects to an attribute, so a diff built
// from attributes alone cannot see the one thing a picker exists to do. Deleting `checked={value}`
// from BooleanPicker made an attribute-only parity file go green.
const formState = (element: Element): string => {
	if (element instanceof HTMLInputElement) return ` value=[${element.value}] checked=${element.checked}`;
	if (element instanceof HTMLSelectElement) return ` value=[${element.value}] selectedIndex=${element.selectedIndex}`;
	if (element instanceof HTMLTextAreaElement) return ` value=[${element.value}]`;
	return '';
};

// Base UI's `Field` adds these on top of the vanilla markup, and every one is additive: `data-*`
// are its styling state hooks, and the aria pair is an association vanilla never had — a
// description that no screen reader could reach. Dropping them from the diff keeps the comparison
// about what the port *changed*; `associations()` below asserts they are wired rather than merely
// present, so this cannot go blind the way an allowlist does.
const BASE_UI_ADDED = /^(data-(disabled|filled|valid|invalid|dirty|touched|focused)|aria-labelledby|aria-describedby)$/;
// Base UI generates ids for the label and description. The values are unstable per render, so the
// diff cannot see them; `associations()` is what checks they point somewhere real.
const GENERATED_ID = /^base-ui-/;

const serialize = (element: Element, depth = 0): string[] => {
	const attributes = Array.from(element.attributes)
		.filter(attribute => !BASE_UI_ADDED.test(attribute.name))
		.filter(attribute => !(attribute.name === 'id' && GENERATED_ID.test(attribute.value)))
		.map(attribute => `${attribute.name}="${attribute.value}"`)
		.sort()
		.join(' ');
	const background = (element as HTMLElement).style?.backgroundImage ?? '';
	const text = Array.from(element.childNodes)
		.filter(node => node.nodeType === Node.TEXT_NODE)
		.map(node => node.textContent)
		.join('');
	const line = `${'  '.repeat(depth)}<${element.tagName.toLowerCase()} ${attributes}> bg=[${background}] text=[${text}] hidden=${(element as HTMLElement).hidden}${formState(element)}`;
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
export const mountBoth = async <ModObject, Config>({
	Vanilla,
	React,
	config,
	makeModObject,
}: {
	Vanilla: new (parent: HTMLElement, modObject: ModObject, config: Config) => VanillaPicker;
	React: (props: { modObject: ModObject; config: Config }) => ReactNode;
	config: Config;
	makeModObject: () => ModObject;
}): Promise<PickerPair<ModObject>> => {
	const vanillaModObject = makeModObject();
	const parent = document.createElement('div');
	document.body.appendChild(parent);
	const vanilla = new Vanilla(parent, vanillaModObject, config);
	// Anything the picker fills asynchronously — an ActionId icon, a tooltip dataset — lands here.
	await act(async () => {});

	const reactModObject = makeModObject();
	const { container, unmount } = render(<React modObject={reactModObject} config={config} />);

	const allDiffs = () => compare(serialize(vanilla.rootElem), serialize(container.firstElementChild!));

	// What the diff above deliberately stops looking at, checked directly instead: the label and the
	// description have to *reach* the control, not just exist next to it.
	const associations = () => {
		const root = container.firstElementChild!;
		const control = root.querySelector('input, select, textarea');
		const problems: string[] = [];
		// Not every consumer has one — ContentBlock is a container, IconPicker renders anchors. There
		// is simply nothing to associate to, which is the vanilla shape too.
		if (!control) return problems;
		const label = root.querySelector('label');
		if (label) {
			if (label.getAttribute('for') !== control.id) problems.push(`label for="${label.getAttribute('for')}" does not match control id="${control.id}"`);
			const labelledBy = control.getAttribute('aria-labelledby');
			if (labelledBy && !root.querySelector(`#${CSS.escape(labelledBy)}`)) problems.push(`aria-labelledby="${labelledBy}" resolves to nothing`);
		}
		const description = root.querySelector('.input-description');
		if (description) {
			const describedBy = control.getAttribute('aria-describedby');
			if (!describedBy) problems.push('a description is rendered but the control has no aria-describedby');
			else if (description.id !== describedBy) problems.push(`aria-describedby="${describedBy}" does not match the description's id="${description.id}"`);
		}
		return problems;
	};

	return {
		vanilla: { modObject: vanillaModObject, rootElem: vanilla.rootElem },
		react: { modObject: reactModObject, rootElem: container.firstElementChild! },
		allDiffs,
		associations,
		// Association problems ride along with the real diffs so that every `expect(pair.diff())`
		// already written covers them; a check nobody asserts is not a check.
		diff: () => [...associations(), ...allDiffs().filter(line => line.includes('[REAL]'))],
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
};
