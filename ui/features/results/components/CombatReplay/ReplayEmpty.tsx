import i18n from '@i18n/config';

export const ReplayEmpty = () => (
	<div className="cr-empty flex flex-1 flex-col items-center justify-center gap-[10px] px-[20px] py-[60px] text-center text-white-50">
		<div className="cr-empty-icon text-[3rem] opacity-30">⚔</div>
		<div className="cr-empty-title text-[1.1rem] font-semibold text-white-70">{i18n.t('combat_replay.empty_title')}</div>
		<div className="cr-empty-desc max-w-[380px] text-[0.85rem]">{i18n.t('combat_replay.empty_desc')}</div>
	</div>
);
