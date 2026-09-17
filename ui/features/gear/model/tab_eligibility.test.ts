import { describe, expect, it } from 'vitest';

import { SelectorModalTabs } from '../types';
import { resolveSelectedTab, TabEligibility } from './tab_eligibility';

const all: TabEligibility = { hasEnchants: true, hasReforges: true, hasUpgrades: true, socketCount: 2 };

describe('resolveSelectedTab', () => {
	it('keeps a tab that has something to show', () => {
		expect(resolveSelectedTab(SelectorModalTabs.Reforging, all)).toBe(SelectorModalTabs.Reforging);
	});

	it('falls back to Items when the requested tab is empty', () => {
		expect(resolveSelectedTab(SelectorModalTabs.Enchants, { ...all, hasEnchants: false })).toBe(SelectorModalTabs.Items);
		expect(resolveSelectedTab(SelectorModalTabs.Reforging, { ...all, hasReforges: false })).toBe(SelectorModalTabs.Items);
		expect(resolveSelectedTab(SelectorModalTabs.Upgrades, { ...all, hasUpgrades: false })).toBe(SelectorModalTabs.Items);
		expect(resolveSelectedTab(SelectorModalTabs.Gem2, { ...all, socketCount: 0 })).toBe(SelectorModalTabs.Items);
	});

	it('leaves a gem tab selected when the slot is empty', () => {
		expect(resolveSelectedTab(SelectorModalTabs.Gem1, { ...all, socketCount: undefined })).toBe(SelectorModalTabs.Gem1);
	});

	it('ignores eligibility that belongs to another tab', () => {
		expect(resolveSelectedTab(SelectorModalTabs.Items, { hasEnchants: false, hasReforges: false, hasUpgrades: false, socketCount: 0 })).toBe(
			SelectorModalTabs.Items,
		);
		expect(resolveSelectedTab(SelectorModalTabs.Tinkers, { ...all, hasEnchants: false })).toBe(SelectorModalTabs.Tinkers);
	});
});
