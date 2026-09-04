/** @jsxImportSource @jsx-vanilla */
import { REPO_URL } from '@domain/constants/other';
import i18n from '@i18n/config';
import { Component } from '@ui-kit/component';
import tippy from 'tippy.js';

export class SocialLinks extends Component {
	static buildDiscordLink(): Element {
		const anchor = (
			<a href="https://discord.gg/p3DgvmnDCS" target="_blank" className="discord-link link-alt" dataset={{ tippyContent: i18n.t('info.discord') }}>
				<i className="fab fa-discord fa-lg" />
			</a>
		);
		tippy(anchor);
		return anchor;
	}

	static buildGitHubLink(): Element {
		const anchor = (
			<a href={REPO_URL} target="_blank" className="github-link link-alt" dataset={{ tippyContent: i18n.t('info.github') }}>
				<i className="fab fa-github fa-lg" />
			</a>
		);
		tippy(anchor);
		return anchor;
	}

	static buildPatreonLink(): Element {
		const anchor = (
			<a href="https://patreon.com/wowsims" target="_blank" className="patreon-link link-alt" dataset={{ tippyContent: i18n.t('info.patreon') }}>
				<i className="fab fa-patreon fa-lg" /> Patreon
			</a>
		);
		tippy(anchor);
		return anchor;
	}
}