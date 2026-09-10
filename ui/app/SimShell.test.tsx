import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SimShell } from './SimShell';
import type { ShellDom } from './shell_dom';

// Everything the sidebar's ordering does not depend on. The picker is stubbed too: what is under
// test is where it sits, not what it renders.
vi.mock('./IterationsPicker', () => ({ IterationsPicker: () => <div className="iterations-picker" /> }));
vi.mock('./header/SimTitleDropdown', () => ({ SimTitleDropdown: () => <div /> }));
vi.mock('./header/SimToolbar', () => ({ SimToolbar: () => <div /> }));
vi.mock('@ui-kit/SocialLink', () => ({ SocialLink: () => <a /> }));
vi.mock('@ui-kit/Toast', () => ({ ToastArea: () => <div className="sim-toast-portal" />, toastManager: {} }));
vi.mock('@sim/hooks/useDisplayMetrics', () => ({ useDisplayMetrics: () => ({}) }));
vi.mock('@sim/hooks/useShowExperimental', () => ({ useShowExperimental: () => false }));

const renderShell = (sidebarActions: React.ReactNode) =>
	render(
		<SimShell
			domRef={createRef<ShellDom | null>()}
			sim={{} as never}
			className="warrior"
			spec={{ launch: 0 } as never}
			knownIssues={[]}
			onOpenSettings={() => {}}
			slots={{ tabs: null, importExport: null, sidebarActions, sidebarResults: null, sidebarStats: null }}
		/>,
	);

describe('SimShell sidebar order', () => {
	it('puts the iterations picker ahead of every registry action', () => {
		const { container } = renderShell(
			<>
				<button className="dps-action" />
				<button className="ep-weights-action" />
			</>,
		);

		const actions = container.querySelector('.sim-sidebar-actions')!;
		expect([...actions.children].map(child => child.className)).toEqual(['iterations-picker', 'dps-action', 'ep-weights-action']);
	});

	it('keeps the picker first when the host has not filled the slot yet', () => {
		const { container } = renderShell(null);

		const actions = container.querySelector('.sim-sidebar-actions')!;
		expect(actions.children).toHaveLength(1);
		expect(actions.firstElementChild?.className).toBe('iterations-picker');
	});
});
