import { fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { ContentBlock, type ContentBlockHeaderProps } from './ContentBlock';

describe('ContentBlock', () => {
	it('renders no header when config.header is absent', () => {
		render(<ContentBlock className="mt-2" config={{}} />);
		expect(screen.queryByTestId('content-block-header')).toBeNull();
	});

	it('renders no header when config.header is an empty object', () => {
		render(<ContentBlock className="mt-2" config={{ header: {} as ContentBlockHeaderProps }} />);
		expect(screen.queryByTestId('content-block-header')).toBeNull();
	});

	it('renders the header with the title text when config.header has a title', () => {
		render(<ContentBlock className="mt-2" config={{ header: { title: 'My Title' } }} />);
		const header = screen.queryByTestId('content-block-header');
		expect(header).not.toBeNull();
		const title = within(header!).getByTestId('content-block-title');
		expect(title.tagName).toBe('H6');
		expect(title.textContent).toBe('My Title');
	});

	it('uses titleTag for the title element, defaulting to h6', () => {
		render(<ContentBlock className="mt-2" config={{ header: { title: 'My Title', titleTag: 'h3' } }} />);
		expect(screen.getByTestId('content-block-title').tagName).toBe('H3');
	});

	// Five of the eight shipped header tooltips are translation strings carrying <strong> or <br>.
	it('renders a header tooltip as HTML, not as escaped text', () => {
		render(<ContentBlock className="mt-2" config={{ header: { title: 'Raid Buffs', tooltip: 'Buffs by <strong>other</strong> members' } }} />);
		fireEvent.mouseEnter(screen.getByRole('button'));
		expect(screen.getByText('other').tagName).toBe('STRONG');
	});

	it('renders headerChildren after the title, inside the header', () => {
		render(<ContentBlock className="mt-2" config={{ header: { title: 'Raid Buffs' } }} headerChildren={<p className="text-sm">Describes it</p>} />);
		const header = screen.getByTestId('content-block-header');
		expect(Array.from(header.children).map(child => child.getAttribute('data-testid') ?? child.tagName)).toEqual(['content-block-title', 'P']);
		expect(header.lastElementChild!.textContent).toBe('Describes it');
	});

	it('puts the tooltip button inside the title element, not the header', () => {
		render(<ContentBlock className="mt-2" config={{ header: { title: 'My Title', tooltip: 'explains it' } }} />);
		const title = screen.getByTestId('content-block-title');
		const button = within(title).queryByRole('button');
		expect(button).not.toBeNull();
		expect(button!.classList.contains('ml-2')).toBe(true);
		// Not a direct child of the header (only of the title).
		const header = screen.getByTestId('content-block-header');
		expect(Array.from(header.children)).toEqual([title]);
	});

	it('renders no tooltip button when config.header.tooltip is absent', () => {
		render(<ContentBlock className="mt-2" config={{ header: { title: 'My Title' } }} />);
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('points headerRef and bodyRef at the header and body elements', () => {
		const headerRef = createRef<HTMLDivElement>();
		const bodyRef = createRef<HTMLDivElement>();
		render(<ContentBlock className="mt-2" config={{ header: { title: 'My Title' } }} headerRef={headerRef} bodyRef={bodyRef} />);
		expect(headerRef.current).toBe(screen.getByTestId('content-block-header'));
		expect(bodyRef.current).toBe(screen.getByTestId('content-block-body'));
	});

	it('leaves headerRef null when there is no header', () => {
		const headerRef = createRef<HTMLDivElement>();
		render(<ContentBlock className="mt-2" config={{}} headerRef={headerRef} />);
		expect(headerRef.current).toBeNull();
	});

	it('renders children inside the body', () => {
		render(
			<ContentBlock className="mt-2" config={{}}>
				<span>child content</span>
			</ContentBlock>,
		);
		const body = screen.getByTestId('content-block-body');
		expect(body.textContent).toBe('child content');
	});

	it('applies className, bodyClassName and header.className', () => {
		const { container } = render(
			<ContentBlock
				className={['mt-2', 'pt-2']}
				config={{
					bodyClassName: ['pb-2'],
					header: { title: 'My Title', className: 'pl-2' },
				}}
			/>,
		);
		const root = container.firstElementChild!;
		expect(Array.from(root.classList).sort()).toEqual(['pt-2', 'ui-content-block', 'flex', 'flex-col', 'mt-2'].sort());
		expect(screen.getByTestId('content-block-header').classList.contains('pl-2')).toBe(true);
		expect(screen.getByTestId('content-block-body').classList.contains('pb-2')).toBe(true);
	});

	it('adds mb-0 to the root when flush is set, and omits it otherwise', () => {
		const { rerender, container } = render(<ContentBlock className="mt-2" config={{}} />);
		expect(container.firstElementChild!.classList.contains('mb-0')).toBe(false);

		rerender(<ContentBlock className="mt-2" config={{}} flush />);
		expect(container.firstElementChild!.classList.contains('mb-0')).toBe(true);
	});
});
