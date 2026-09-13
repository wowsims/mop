import i18n from '@i18n/config';

export const ReplayEmpty = () => (
	<div className="cr-empty">
		<div className="cr-empty-icon">⚔</div>
		<div className="cr-empty-title">{i18n.t('combat_replay.empty_title')}</div>
		<div className="cr-empty-desc">{i18n.t('combat_replay.empty_desc')}</div>
	</div>
);
