import { GemColor } from '@generated/proto/common';
import type { UIGem as Gem } from '@generated/proto/ui';
import { getEmptyGemSocketIconUrl } from '@sim/proto/gems';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const useActionId = vi.hoisted(() => vi.fn(() => ({ iconUrl: 'gem-icon.jpg', name: '', href: '', ready: true })));

vi.mock('@ui-kit/hooks/useActionId', () => ({ useActionId }));

const { TabGemIcon } = await import('./TabGemIcon');

describe('TabGemIcon', () => {
	const gem = { id: 42, name: 'Gem' } as Gem;

	it('shows the gem icon and the socket icon for a filled socket', () => {
		const { container } = render(<TabGemIcon socketColor={GemColor.GemColorRed} gem={gem} />);

		const gemIcon = container.querySelector<HTMLImageElement>('.gem-icon')!;
		const socketIcon = container.querySelector<HTMLImageElement>('.socket-icon')!;
		expect(gemIcon.classList.contains('hide')).toBe(false);
		expect(gemIcon.src).toContain('gem-icon.jpg');
		expect(socketIcon.src).toContain(getEmptyGemSocketIconUrl(GemColor.GemColorRed));
	});

	it('hides the gem icon and points both images at the empty socket for an empty socket', () => {
		const { container } = render(<TabGemIcon socketColor={GemColor.GemColorRed} gem={null} />);

		const gemIcon = container.querySelector<HTMLImageElement>('.gem-icon')!;
		const socketIcon = container.querySelector<HTMLImageElement>('.socket-icon')!;
		const emptyUrl = getEmptyGemSocketIconUrl(GemColor.GemColorRed);
		expect(gemIcon.classList.contains('hide')).toBe(true);
		expect(gemIcon.src).toContain(emptyUrl);
		expect(socketIcon.src).toContain(emptyUrl);
		expect(useActionId).toHaveBeenCalledWith(undefined);
	});

	it('resolves a different empty-socket url for a different socket color', () => {
		const { container: red } = render(<TabGemIcon socketColor={GemColor.GemColorRed} gem={null} />);
		const { container: blue } = render(<TabGemIcon socketColor={GemColor.GemColorBlue} gem={null} />);

		const redSrc = red.querySelector<HTMLImageElement>('.socket-icon')!.src;
		const blueSrc = blue.querySelector<HTMLImageElement>('.socket-icon')!.src;
		expect(redSrc).not.toBe(blueSrc);
	});
});
