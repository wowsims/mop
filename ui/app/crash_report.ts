import i18n from '@i18n/config';
import { REPO_NEW_ISSUE_URL } from '@sim/constants/other';
import { ActionId } from '@sim/proto/action_id';
import { SimError } from '@sim/sim';
import { toastManager } from '@ui-kit/Toast';

import type { CrashReportOpener } from './crash_report_opener';

const URLMAXLEN = 2048;

function hashCode(str: string): number {
	let hash = 0;
	for (let i = 0, len = str.length; i < len; i++) {
		const chr = str.charCodeAt(i);
		hash = (hash << 5) - hash + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
}

export interface CrashReportContext {
	crashReport: CrashReportOpener;
	toLink: () => string;
	getLastUsedRngSeed: () => number;
}

export async function reportSimCrash(error: any, ctx: CrashReportContext): Promise<void> {
	if (!(error instanceof SimError)) {
		if (error.message) {
			toastManager.add({
				variant: 'error',
				body: error.message,
			});
		} else {
			alert(error);
		}
		return;
	}

	toastManager.add({
		variant: 'error',
		body: i18n.t('sim.notifications.simulation_failed'),
	});

	const errorStr = (error as SimError).errorStr;
	if (errorStr.startsWith('[USER_ERROR] ')) {
		let alertStr = errorStr.substring('[USER_ERROR] '.length);
		alertStr = await ActionId.replaceAllInString(alertStr);
		alert(alertStr);
		return;
	}

	if (window.confirm(i18n.t('sim.crash_report.confirm_title') + '\n' + errorStr + '\n' + i18n.t('sim.crash_report.confirm_message'))) {
		// Splice out just the line numbers
		const hash = hashCode(errorStr);
		const link = ctx.toLink();
		const rngSeed = ctx.getLastUsedRngSeed();
		fetch('https://api.github.com/search/issues?q=is:issue+is:open+repo:wowsims/mop+' + hash)
			.then(resp => {
				resp.json().then(issues => {
					if (issues.total_count > 0) {
						window.open(issues.items[0].html_url, '_blank');
					} else {
						const url = new URL(REPO_NEW_ISSUE_URL);
						url.searchParams.append('title', `${i18n.t('sim.crash_report.report_title')} ${hash}`);
						url.searchParams.append('assignees', '');
						url.searchParams.append('labels', '');

						const maxBodyLength = URLMAXLEN - url.toString().length;
						let issueBody = `Link:\n${link}\n\nRNG Seed: ${rngSeed}\n\n${errorStr}`;
						let truncated = false;
						while (issueBody.length > maxBodyLength - (truncated ? 3 : 0)) {
							issueBody = issueBody.slice(0, issueBody.lastIndexOf('%')); // Avoid truncating in the middle of a URLencoded segment.
							truncated = true;
						}
						if (truncated) {
							issueBody += '...';
							// Prompt the user to add more information to the issue.
							ctx.crashReport.open(link);
						}
						url.searchParams.append('body', issueBody);

						window.open(url.toString(), '_blank');
					}
				});
			})
			.catch(fetchErr => {
				alert(i18n.t('sim.notifications.failed_to_file_report') + fetchErr);
			});
	}
}
