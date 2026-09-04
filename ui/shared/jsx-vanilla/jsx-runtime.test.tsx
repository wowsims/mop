/** @jsxImportSource @jsx-vanilla */
// Locks the automatic-runtime shim to tsx-vanilla's classic behaviour. Every case here is one the
// shim could plausibly get wrong, because the automatic runtime moves children into props while
// tsx-vanilla's element() takes them as varargs.
import { ref } from 'tsx-vanilla';
import { describe, expect, it } from 'vitest';

const html = (node: unknown) => (node as HTMLElement).outerHTML;

describe('jsx-vanilla runtime shim', () => {
	it('returns real DOM nodes, not React elements', () => {
		const el = <div className="a" />;
		expect(el).toBeInstanceOf(HTMLElement);
		expect(html(el)).toBe('<div class="a"></div>');
	});

	it('appends a single child', () => {
		expect(html(<div><span>x</span></div>)).toBe('<div><span>x</span></div>');
	});

	it('appends multiple children in order', () => {
		expect(html(<div><i>1</i><b>2</b><u>3</u></div>)).toBe('<div><i>1</i><b>2</b><u>3</u></div>');
	});

	it('flattens array children', () => {
		const items = ['a', 'b'].map(t => <li>{t}</li>);
		expect(html(<ul>{items}</ul>)).toBe('<ul><li>a</li><li>b</li></ul>');
	});

	it('skips null, undefined and boolean children so `cond && <x/>` renders nothing', () => {
		const show = false;
		expect(html(<div>{show && <span>no</span>}{null}{undefined}</div>)).toBe('<div></div>');
	});

	it('renders 0 rather than skipping it', () => {
		expect(html(<div>{0}</div>)).toBe('<div>0</div>');
	});

	it('never assigns children as a DOM property', () => {
		const el = <div><span /></div> as HTMLElement;
		expect(Object.prototype.hasOwnProperty.call(el, 'children')).toBe(false);
		expect(el.children.length).toBe(1);
	});

	it('passes children through to function components', () => {
		const Box = ({ title, children }: { title: string; children?: JSX.Child | JSX.Children }) => (
			<section className="box"><h1>{title}</h1>{children}</section>
		);
		expect(html(<Box title="t"><p>body</p></Box>)).toBe('<section class="box"><h1>t</h1><p>body</p></section>');
	});

	it('gives a component a single child unwrapped and several as an array', () => {
		let seen: unknown;
		const Probe = ({ children }: { children?: unknown }) => { seen = children; return <div /> };
		<Probe><i /></Probe>;
		expect(Array.isArray(seen)).toBe(false);
		<Probe><i /><b /></Probe>;
		expect(Array.isArray(seen)).toBe(true);
		expect((seen as unknown[]).length).toBe(2);
	});

	it('renders fragments without a wrapper element', () => {
		const frag = <><i>1</i><b>2</b></>;
		expect(frag).toBeInstanceOf(DocumentFragment);
		const host = <div>{frag}</div>;
		expect(html(host)).toBe('<div><i>1</i><b>2</b></div>');
	});

	it('still honours tsx-vanilla special props: ref, dataset, style, attributes', () => {
		const r = ref<HTMLDivElement>();
		const el = <div ref={r} dataset={{ whtticon: 'false' }} style={{ color: 'red' }} attributes={{ role: 'alert' }} /> as HTMLElement;
		expect(r.value).toBe(el);
		expect(el.dataset.whtticon).toBe('false');
		expect(el.style.color).toBe('red');
		expect(el.getAttribute('role')).toBe('alert');
	});
});
