import { ProtoVersion } from '@generated/proto/common';
import { readMessageOption } from '@protobuf-ts/runtime';

export enum Phase {
	Phase1 = 1,
	Phase2,
	Phase3,
	Phase4,
	Phase5,
}

export const CURRENT_PHASE = Phase.Phase5;

export enum LaunchStatus {
	Unlaunched,
	Alpha,
	Beta,
	Launched,
}

export const CURRENT_API_VERSION: number = readMessageOption(ProtoVersion, 'proto.current_version_number')! as number;

// Github pages serves our site under the /mop directory (because the repo name is mop)
export const REPO_NAME = 'mop';
export const REPO_URL = `https://github.com/wowsims/${REPO_NAME}`;
export const REPO_RELEASES_URL = `${REPO_URL}/releases`;
export const REPO_NEW_ISSUE_URL = `${REPO_URL}/issues/new`;
export const REPO_CHOOSE_NEW_ISSUE_URL = `${REPO_NEW_ISSUE_URL}/choose`;

export const SOCIALS = [
	{ key: 'discord', href: 'https://discord.gg/p3DgvmnDCS', className: 'discord-link link-alt', icon: 'discord', tooltip: 'info.discord' },
	{ key: 'github', href: REPO_URL, className: 'github-link link-alt', icon: 'github', tooltip: 'info.github' },
	{
		key: 'patreon',
		href: 'https://patreon.com/wowsims',
		className: 'patreon-link link-alt',
		icon: 'patreon',
		tooltip: 'info.patreon',
		label: ' Patreon',
	},
] as const;

export type Social = (typeof SOCIALS)[number];

// Root-relative path of the individual sim page for the given spec. Resolve it
// against the page origin at the point of use (see SimTitleDropdown) — this
// layer has no `window`. Lives here rather than in proto_utils/utils so that
// player_specs/<class>.ts (which calls it at module scope) does not import the
// proto_utils <-> player_specs cycle; the evaluation order of that cycle decides
// whether PlayerSpecs' lookup table is populated.
export function getSpecSitePath(classString: string, specString: string): string {
	return `/${REPO_NAME}/${classString}/${specString}/`;
}

export const LOCAL_STORAGE_PREFIX = '__mop';

export enum SortDirection {
	ASC,
	DESC,
}
