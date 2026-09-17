import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';

export interface GearPlannerNoticeProps {
	isHealingSpec: boolean;
}

// Takes the unlaunched notice's place for a spec that plans gear but never simulates.
export const GearPlannerNotice = ({ isHealingSpec }: GearPlannerNoticeProps) => (
	<div className="mt-auto mr-auto mb-auto ml-auto flex max-w-100 flex-col items-center text-center" data-testid="sim-ui-gear-planner-container">
		<Icon name="screwdriver-wrench" size="3x" className="mb-2" />
		<h6>{i18n.t('sim.gear_planner.title')}</h6>
		<p>{i18n.t('sim.gear_planner.message')}</p>
		{isHealingSpec && (
			<p>
				{i18n.t('sim.unlaunched.healing_message')}
				<br />
				<Button as="a" variant="unstyled" href="https://questionablyepic.com/live/" target="_blank">
					{i18n.t('sim.unlaunched.qe_live_message')}
				</Button>
			</p>
		)}
	</div>
);
