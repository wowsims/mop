import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';

export interface UnlaunchedNoticeProps {
	isHealingSpec: boolean;
}

export const UnlaunchedNotice = ({ isHealingSpec }: UnlaunchedNoticeProps) => (
	<div className="sim-ui-unlaunched-container d-flex flex-column align-items-center text-center mt-auto mb-auto ms-auto me-auto">
		<Icon name="ban" size="3x" className="mb-2" />
		<h6>{i18n.t('sim.unlaunched.title')}</h6>
		<p>
			{i18n.t('sim.unlaunched.contribute_message')}
			<br />
			{i18n.t('sim.unlaunched.discord_message')}{' '}
			<Button as="a" variant="unstyled" href="https://discord.gg/p3DgvmnDCS" target="_blank">
				Discord
			</Button>
			!
		</p>
		{isHealingSpec && (
			<p>
				{i18n.t('sim.unlaunched.healing_message')}
				<br />
				{i18n.t('sim.unlaunched.qe_live_message')}{' '}
				<Button as="a" variant="unstyled" href="https://questionablyepic.com/live/">
					QE Live
				</Button>
				!
			</p>
		)}
	</div>
);
