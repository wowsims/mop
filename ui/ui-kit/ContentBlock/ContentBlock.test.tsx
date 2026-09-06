import { fireEvent, render, screen } from '@testing-library/react';
import type { ContentBlockHeaderConfig } from '@ui-kit/content_block';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { ContentBlock } from './ContentBlock';

describe('ContentBlock', () => {
	it('renders no header when config.header is absent', () => {
		const { container } = render(<ContentBlock cssClass="my-block" config={{}} />);
		expect(container.querySelector('.content-block-header')).toBeNull();
	});

	it('renders no header when config.header is an empty object', () => {
		const { container } = render(<ContentBlock cssClass="my-block" config={{ header: {} as ContentBlockHeaderConfig }} />);
		expect(container.querySelector('.content-block-header')).toBeNull();
	});

	it('renders the header with the title text when config.header has a title', () => {
		const { container } = render(<ContentBlock cssClass="my-block" config={{ header: { title: 'My Title' } }} />);
		const header = container.querySelector('.content-block-header');
		expect(header).not.toBeNull();
		const title = header!.querySelector('.content-block-title')!;
		expect(title.tagName).toBe('H6');
		expect(title.textContent).toBe('My Title');
	});

	it('uses titleTag for the title element, defaulting to h6', () => {
		const { container } = render(<ContentBlock cssClass="my-block" config={{ header: { title: 'My Title', titleTag: 'h3' } }} />);
		expect(container.querySelector('.content-block-title')!.tagName).toBe('H3');
	});

	// The vanilla TooltipButton passes tippy `allowHTML: true`, and five of the eight shipped header
	// tooltips are translation strings carrying <strong> or <br>.
	it('renders a header tooltip as HTML, not as escaped text', () => {
		render(<ContentBlock cssClass="my-block" config={{ header: { title: 'Raid Buffs', tooltip: 'Buffs by <strong>other</strong> members' } }} />);
		fireEvent.mouseEnter(screen.getByRole('button'));
		expect(screen.getByText('other').tagName).toBe('STRONG');
	});

	it('renders headerChildren after the title, inside the header', () => {
		const { container } = render(
			<ContentBlock cssClass="my-block" config={{ header: { title: 'Raid Buffs' } }} headerChildren={<p className="fs-body">Describes it</p>} />,
		);
		const header = container.querySelector('.content-block-header')!;
		expect(Array.from(header.children).map(child => child.className)).toEqual(['content-block-title', 'fs-body']);
	});

	it('puts the tooltip button inside the title element, not the header', () => {
		const { container } = render(<ContentBlock cssClass="my-block" config={{ header: { title: 'My Title', tooltip: 'explains it' } }} />);
		const title = container.querySelector('.content-block-title')!;
		const button = title.querySelector('button.tooltip-button');
		expect(button).not.toBeNull();
		expect(button!.classList.contains('ms-2')).toBe(true);
		// Not a direct child of the header (only of the title).
		const header = container.querySelector('.content-block-header')!;
		expect(Array.from(header.children)).toEqual([title]);
	});

	it('renders no tooltip button when config.header.tooltip is absent', () => {
		const { container } = render(<ContentBlock cssClass="my-block" config={{ header: { title: 'My Title' } }} />);
		expect(container.querySelector('.tooltip-button')).toBeNull();
	});

	it('points headerRef and bodyRef at the header and body elements', () => {
		const headerRef = createRef<HTMLDivElement>();
		const bodyRef = createRef<HTMLDivElement>();
		const { container } = render(<ContentBlock cssClass="my-block" config={{ header: { title: 'My Title' } }} headerRef={headerRef} bodyRef={bodyRef} />);
		expect(headerRef.current).toBe(container.querySelector('.content-block-header'));
		expect(bodyRef.current).toBe(container.querySelector('.content-block-body'));
	});

	it('leaves headerRef null when there is no header', () => {
		const headerRef = createRef<HTMLDivElement>();
		render(<ContentBlock cssClass="my-block" config={{}} headerRef={headerRef} />);
		expect(headerRef.current).toBeNull();
	});

	it('renders children inside the body', () => {
		const { container } = render(
			<ContentBlock cssClass="my-block" config={{}}>
				<span>child content</span>
			</ContentBlock>,
		);
		const body = container.querySelector('.content-block-body')!;
		expect(body.textContent).toBe('child content');
	});

	it('applies cssClass, extraCssClasses, bodyClasses and header.extraCssClasses', () => {
		const { container } = render(
			<ContentBlock
				cssClass="my-block"
				config={{
					extraCssClasses: ['blk-extra'],
					bodyClasses: ['body-extra'],
					header: { title: 'My Title', extraCssClasses: ['header-extra'] },
				}}
			/>,
		);
		const root = container.firstElementChild!;
		expect(Array.from(root.classList).sort()).toEqual(['blk-extra', 'content-block', 'my-block'].sort());
		expect(container.querySelector('.content-block-header')!.classList.contains('header-extra')).toBe(true);
		expect(container.querySelector('.content-block-body')!.classList.contains('body-extra')).toBe(true);
	});
});
