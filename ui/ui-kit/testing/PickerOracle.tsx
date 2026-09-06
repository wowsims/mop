import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';

export interface VanillaPicker {
	rootElem: HTMLElement;
	dispose(): void;
}

export interface PickerPair<ModObject> {
	vanilla: { modObject: ModObject; rootElem: HTMLElement };
	react: { modObject: ModObject; rootElem: Element };
	diff(): string[];
	allDiffs(): string[];
	associations(): string[];
	step(mutate: (modObject: ModObject) => void): Promise<void>;
	dispose(): void;
}

// What a field shows lives in an IDL property that never reflects to an attribute, so a diff built from attributes alone cannot see the one thing a picker exists to do.
const formState = (element: Element): string => {
	if (element instanceof HTMLInputElement) return ` value=[${element.value}] checked=${element.checked}`;
	if (element instanceof HTMLSelectElement) return ` value=[${element.value}] selectedIndex=${element.selectedIndex}`;
	if (element instanceof HTMLTextAreaElement) return ` value=[${element.value}]`;
	return '';
};

// Base UI's `Field` adds these on top of the vanilla markup, and every one is additive: `data-*` are its styling state hooks, and the aria pair is an association vanilla never had — a description that no screen reader could reach.
const BASE_UI_ADDED = /^(data-(disabled|filled|valid|invalid|dirty|touched|focused)|aria-labelledby|aria-describedby)$/;
// Base UI generates ids for the label and description.
const GENERATED_ID = /^base-ui-/;

const serialize = (element: Element, depth = 0, portAdded?: RegExp): string[] => {
	const attributes = Array.from(element.attributes)
		.filter(attribute => !BASE_UI_ADDED.test(attribute.name))
		.filter(attribute => !portAdded?.test(attribute.name))
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
	return [line, ...Array.from(element.children).flatMap(child => serialize(child, depth + 1, portAdded))];
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

/** Mounts a vanilla picker and its React port over equivalent mod objects and diffs the two trees, element by element and attribute by attribute. */
export const mountBoth = async <ModObject, Config>({
	Vanilla,
	React,
	config,
	makeModObject,
	normaliseVanilla,
	portAdded,
}: {
	Vanilla: new (parent: HTMLElement, modObject: ModObject, config: Config) => VanillaPicker;
	React: (props: { modObject: ModObject; config: Config }) => ReactNode;
	config: Config;
	makeModObject: () => ModObject;
	// A port that re-parents a subtree shifts every line's indent, which a line-by-line diff cannot express; folding the vanilla side into the new shape keeps the rest of the comparison byte for byte.
	normaliseVanilla?: (lines: string[]) => string[];
	// Attributes the port adds that vanilla never had. Named per picker rather than added to
	// `BASE_UI_ADDED`: a blanket rule would also hide a port that *dropped* one vanilla did have.
	portAdded?: RegExp;
}): Promise<PickerPair<ModObject>> => {
	const vanillaModObject = makeModObject();
	const parent = document.createElement('div');
	document.body.appendChild(parent);
	const vanilla = new Vanilla(parent, vanillaModObject, config);
	await act(async () => {});

	const reactModObject = makeModObject();
	const { container, unmount } = render(<React modObject={reactModObject} config={config} />);

	const allDiffs = () =>
		compare((normaliseVanilla ?? (lines => lines))(serialize(vanilla.rootElem, 0, portAdded)), serialize(container.firstElementChild!, 0, portAdded));

	const associations = () => {
		const root = container.firstElementChild!;
		const control = root.querySelector('input, select, textarea');
		const problems: string[] = [];
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
