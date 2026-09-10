import { SimHostProvider } from '@sim/context/SimHostContext';
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CrashReportDialog } from './CrashReportDialog';
import { CrashReportOpener } from './crash_report_opener';

const mount = () => {
	const opener = new CrashReportOpener();
	render(
		<SimHostProvider host={{ rootElem: document.body } as never}>
			<CrashReportDialog opener={opener} />
		</SimHostProvider>,
	);
	return opener;
};

const report = () => document.querySelector<HTMLTextAreaElement>('.sim-crash-report-text');

describe('CrashReportDialog', () => {
	it('stays out of the document until the shell opens it', () => {
		mount();

		expect(report()).toBeNull();
	});

	it('shows the link the shell reported', () => {
		const opener = mount();

		act(() => opener.open('https://wowsims.github.io/mop/warrior/arms/#eJxT'));

		expect(report()!.value).toBe('https://wowsims.github.io/mop/warrior/arms/#eJxT');
	});

	// The field is uncontrolled, as vanilla's was, so a second crash only replaces its text because
	// the textarea is keyed on the link.
	it('replaces the link when a second crash is reported', () => {
		const opener = mount();

		act(() => opener.open('first'));
		act(() => opener.setOpen(false));
		act(() => opener.open('second'));

		expect(report()!.value).toBe('second');
	});
});
