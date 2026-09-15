import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Dialog } from '../Dialog/Dialog';
import { PortalContainerContext } from './usePortalContainer';

describe('usePortalContainer', () => {
	it('portals into the context container when no explicit container is given', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);

		render(
			<PortalContainerContext value={host}>
				<Dialog open onOpenChange={() => {}} title="Options">
					body
				</Dialog>
			</PortalContainerContext>,
		);
		expect(host.contains(screen.getByRole('dialog'))).toBe(true);

		host.remove();
	});

	it('lets an explicit container win over the context', () => {
		const contextHost = document.createElement('div');
		const explicitHost = document.createElement('div');
		document.body.appendChild(contextHost);
		document.body.appendChild(explicitHost);

		render(
			<PortalContainerContext value={contextHost}>
				<Dialog open onOpenChange={() => {}} container={explicitHost} title="Options">
					body
				</Dialog>
			</PortalContainerContext>,
		);
		expect(explicitHost.contains(screen.getByRole('dialog'))).toBe(true);
		expect(contextHost.contains(screen.getByRole('dialog'))).toBe(false);

		contextHost.remove();
		explicitHost.remove();
	});

	it('falls back to document.body with no context and no explicit container', () => {
		render(
			<Dialog open onOpenChange={() => {}} title="Options">
				body
			</Dialog>,
		);
		expect(document.body.contains(screen.getByRole('dialog'))).toBe(true);
	});
});
