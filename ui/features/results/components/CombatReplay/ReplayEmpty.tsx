import i18n from '@i18n/config';

export const ReplayEmpty = () => (
	<div data-testid="cr-empty" className="flex flex-1 flex-col items-center justify-center gap-2.5 px-5 py-15 text-center text-white-50">
		<div className="text-[3rem] opacity-30">⚔</div>
		<div data-testid="cr-empty-title" className="text-[1.1rem] font-semibold text-white-70">
			{i18n.t('combat_replay.empty_title')}
		</div>
		<div className="max-w-95 text-[0.85rem]">{i18n.t('combat_replay.empty_desc')}</div>
	</div>
);
