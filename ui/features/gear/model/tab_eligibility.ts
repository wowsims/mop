import { SelectorModalTabs } from '../types';

export type TabEligibility = {
	hasEnchants: boolean;
	hasReforges: boolean;
	hasUpgrades: boolean;
	socketCount: number | undefined;
};

export const resolveSelectedTab = (selectedTab: SelectorModalTabs, { hasEnchants, hasReforges, hasUpgrades, socketCount }: TabEligibility) => {
	if (
		(selectedTab === SelectorModalTabs.Enchants && !hasEnchants) ||
		(selectedTab === SelectorModalTabs.Reforging && !hasReforges) ||
		(selectedTab === SelectorModalTabs.Upgrades && !hasUpgrades) ||
		([SelectorModalTabs.Gem1, SelectorModalTabs.Gem2, SelectorModalTabs.Gem3].includes(selectedTab) && socketCount === 0)
	) {
		return SelectorModalTabs.Items;
	}
	return selectedTab;
};
