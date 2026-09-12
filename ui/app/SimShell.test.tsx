import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { SimHostObject } from './individual_sim_ui';
import type { ShellDom } from './types/shell_dom';
import { SimShell } from './SimShell';

// Everything the sidebar's ordering does not depend on. The picker is stubbed too: what is under
// test is where it sits, not what it renders.
vi.mock('./IterationsPicker', () => ({ IterationsPicker: () => <div className="iterations-picker" /> }));
vi.mock('./SimSidebarActions', () => ({
	SimSidebarActions: () => (
		<>
			<button className="dps-action" />
			<button className="ep-weights-action" />
		</>
	),
}));
vi.mock('./SimTabsSection', () => ({ SimTabsSection: () => <div /> }));
vi.mock('./SimImportExport', () => ({ SimImportExport: () => <div /> }));
vi.mock('@features/results/components/SimResultsPanel', () => ({ SimResultsPanel: () => <div /> }));
vi.mock('@features/character-stats', () => ({ CharacterStats: () => <div /> }));
vi.mock('./header/SimTitleDropdown', () => ({ SimTitleDropdown: () => <div /> }));
vi.mock('./header/SimToolbar', () => ({ SimToolbar: () => <div /> }));
vi.mock('@ui-kit/SocialLink', () => ({ SocialLink: () => <a /> }));
vi.mock('@ui-kit/Toast', () => ({ ToastArea: () => <div className="sim-toast-portal" />, toastManager: {} }));
vi.mock('@sim/hooks/useDisplayMetrics', () => ({ useDisplayMetrics: () => ({}) }));
vi.mock('@sim/hooks/useShowExperimental', () => ({ useShowExperimental: () => false }));

const renderShell = (host: SimHostObject<any> | null) =>
	render(
		<SimShell
			domRef={createRef<ShellDom | null>()}
			host={host}
			sim={{} as never}
			className="warrior"
			spec={{ launch: 0 } as never}
			knownIssues={[]}
			onOpenSettings={() => {}}
		/>,
	);

describe('SimShell sidebar order', () => {
	it('puts the iterations picker ahead of every registry action', () => {
		const { container } = renderShell({} as SimHostObject<any>);

		const actions = container.querySelector('.sim-sidebar-actions')!;
		expect([...actions.children].map(child => child.className)).toEqual(['iterations-picker', 'dps-action', 'ep-weights-action']);
	});

	it('keeps the picker first when the host has not been constructed yet', () => {
		const { container } = renderShell(null);

		const actions = container.querySelector('.sim-sidebar-actions')!;
		expect(actions.children).toHaveLength(1);
		expect(actions.firstElementChild?.className).toBe('iterations-picker');
	});
});
