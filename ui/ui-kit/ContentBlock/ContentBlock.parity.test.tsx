import type { ContentBlockConfig, ContentBlockHeaderConfig } from '@ui-kit/content_block';
import { ContentBlock as VanillaContentBlock } from '@ui-kit/content_block';
import type { VanillaPicker } from '@ui-kit/react/PickerOracle';
import { mountBoth } from '@ui-kit/react/PickerOracle';
import { describe, expect, it } from 'vitest';

import { ContentBlock } from './ContentBlock';

interface ModObject {
	cssClass: string;
	withBodyChild?: boolean;
	withHeaderChild?: boolean;
}

// `mountBoth` takes `(parent, modObject, config)` for the vanilla side, but `ContentBlock`'s
// constructor is `(parent, cssClass, config)` — there is no mod object. Adapted here rather than
// widening `mountBoth`: `modObject` carries the `cssClass` plus whether to append a body child,
// since `children` (the React side's own axis) has no vanilla counterpart to diff against — for
// the "body with children" case the same node is appended to the vanilla body instead of leaving
// React's side empty, so the diff actually covers it.
class VanillaAdapter implements VanillaPicker {
	private readonly inner: VanillaContentBlock;
	readonly rootElem: HTMLElement;

	constructor(parent: HTMLElement, modObject: ModObject, config: ContentBlockConfig) {
		this.inner = new VanillaContentBlock(parent, modObject.cssClass, config);
		if (modObject.withBodyChild) {
			const span = document.createElement('span');
			span.textContent = 'Hello';
			this.inner.bodyElement.appendChild(span);
		}
		// settings_tab.tsx:204 and the three gear summaries append into headerElement after
		// construction; `headerChildren` is where those nodes land in React.
		if (modObject.withHeaderChild) {
			const paragraph = document.createElement('p');
			paragraph.className = 'fs-body';
			paragraph.textContent = 'Describes it';
			this.inner.headerElement!.appendChild(paragraph);
		}
		this.rootElem = this.inner.rootElem;
	}

	dispose() {
		this.inner.dispose();
	}
}

const ReactAdapter = ({ modObject, config }: { modObject: ModObject; config: ContentBlockConfig }) => {
	return (
		<ContentBlock cssClass={modObject.cssClass} config={config} headerChildren={modObject.withHeaderChild && <p className="fs-body">Describes it</p>}>
			{modObject.withBodyChild && <span>Hello</span>}
		</ContentBlock>
	);
};

const both = (config: ContentBlockConfig, extra: Partial<ModObject> = {}) =>
	mountBoth({ Vanilla: VanillaAdapter, React: ReactAdapter, config, makeModObject: () => ({ cssClass: 'my-block', ...extra }) });

describe('ContentBlock matches the vanilla content block', () => {
	const cases: Array<[string, ContentBlockConfig]> = [
		['no header', {}],
		['header: {} renders no header', { header: {} as ContentBlockHeaderConfig }],
		['title only', { header: { title: 'Title' } }],
		['title + extraCssClasses', { header: { title: 'Title', extraCssClasses: ['x-a', 'x-b'] } }],
		['bodyClasses', { bodyClasses: ['body-a', 'body-b'] }],
		['extraCssClasses on the block', { extraCssClasses: ['blk-a', 'blk-b'] }],
	];

	for (const [name, config] of cases) {
		it(name, async () => {
			const pair = await both(config);
			expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
			pair.dispose();
		});
	}

	it('body with children (same node appended to both sides)', async () => {
		const pair = await both({}, { withBodyChild: true });
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});

	// Decided divergences (see the component's doc comment and the task notes): the React
	// TooltipButton renders `Icon`'s FA6 name (`fa-circle-question`) where the vanilla tippy button
	// hardcodes FA5's `fa-question-circle`, and it adds a react-tooltip DOM node (with a
	// `data-tooltip-id`) beside the button that the vanilla tippy instance has no DOM counterpart
	// for. Both are pre-existing, intentional TooltipButton decisions, not something to fix here.
	it('puts headerChildren where the vanilla callers append into headerElement', async () => {
		const pair = await both({ header: { title: 'Title' } }, { withHeaderChild: true });
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});

	it('title + tooltip: only the documented TooltipButton divergences appear', async () => {
		const pair = await both({ header: { title: 'Title', tooltip: 'Explains it' } });
		// Exactly two lines may differ — the button's `data-tooltip-id`, and the glyph line, where
		// `Icon` renders the FA6 name and adds `aria-hidden`. Anything else is a real difference.
		const known = (line: string) =>
			(line.includes('tooltip-button') && line.includes('data-tooltip-id')) ||
			(line.includes('fa-question-circle') && line.includes('fa-circle-question') && line.includes('aria-hidden'));
		expect(
			pair.diff().filter(line => !known(line)),
			pair.allDiffs().join('\n'),
		).toEqual([]);
		expect(pair.diff()).toHaveLength(2);
		pair.dispose();
	});
});
