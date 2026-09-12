import { ItemQuality } from '@generated/proto/common';
import { ResourceType, SecondaryResourceType } from '@generated/proto/spell';
import { UIItem_FactionRestriction } from '@generated/proto/ui';

export const QUALITY_TEXT: Record<ItemQuality, string> = {
	[ItemQuality.ItemQualityJunk]: 'text-quality-junk',
	[ItemQuality.ItemQualityCommon]: 'text-quality-common',
	[ItemQuality.ItemQualityUncommon]: 'text-quality-uncommon',
	[ItemQuality.ItemQualityRare]: 'text-quality-rare',
	[ItemQuality.ItemQualityEpic]: 'text-quality-epic',
	[ItemQuality.ItemQualityLegendary]: 'text-quality-legendary',
	[ItemQuality.ItemQualityArtifact]: 'text-quality-artifact',
	[ItemQuality.ItemQualityHeirloom]: 'text-quality-heirloom',
};

export const RESOURCE_TEXT: Partial<Record<ResourceType, string>> = {
	[ResourceType.ResourceTypeHealth]: 'text-resource-health',
	[ResourceType.ResourceTypeMana]: 'text-resource-mana',
	[ResourceType.ResourceTypeEnergy]: 'text-resource-energy',
	[ResourceType.ResourceTypeRage]: 'text-resource-rage',
	[ResourceType.ResourceTypeChi]: 'text-resource-chi',
	[ResourceType.ResourceTypeComboPoints]: 'text-resource-combo-points',
	[ResourceType.ResourceTypeFocus]: 'text-resource-focus',
	[ResourceType.ResourceTypeSolarEnergy]: 'text-resource-solar-energy',
	[ResourceType.ResourceTypeLunarEnergy]: 'text-resource-lunar-energy',
};

export const SECONDARY_RESOURCE_TEXT: Partial<Record<SecondaryResourceType, string>> = {
	[SecondaryResourceType.SecondaryResourceTypeHolyPower]: 'text-resource-holy-power',
};

export const resourceTextClass = (resourceType: ResourceType, secondaryResourceType?: SecondaryResourceType): string | undefined => {
	if (secondaryResourceType !== undefined) return SECONDARY_RESOURCE_TEXT[secondaryResourceType];
	return RESOURCE_TEXT[resourceType];
};

export const SPELL_SCHOOL_TEXT: Record<string, string> = {
	physical: 'text-school-physical',
	arcane: 'text-school-arcane',
	fire: 'text-school-fire',
	frost: 'text-school-frost',
	holy: 'text-school-holy',
	nature: 'text-school-nature',
	shadow: 'text-school-shadow',
	chaos: 'text-school-chaos',
	astral: 'bg-linear-to-r/srgb from-school-nature to-school-arcane bg-clip-text text-primary [-webkit-text-fill-color:transparent]',
	shadowflame: 'bg-linear-to-r/srgb from-school-shadow to-school-fire bg-clip-text text-primary [-webkit-text-fill-color:transparent]',
	spellfire: 'bg-linear-to-r/srgb from-school-fire to-school-arcane bg-clip-text text-primary [-webkit-text-fill-color:transparent]',
	spellfrost: 'bg-linear-to-r/srgb from-school-arcane to-school-frost bg-clip-text text-primary [-webkit-text-fill-color:transparent]',
	frostfire: 'bg-linear-to-r/srgb from-school-frost to-school-fire bg-clip-text text-primary [-webkit-text-fill-color:transparent]',
	shadowfrost: 'bg-linear-to-r/srgb from-school-shadow to-school-frost bg-clip-text text-primary [-webkit-text-fill-color:transparent]',
	plague: 'bg-linear-to-r/srgb from-school-shadow to-school-nature bg-clip-text text-primary [-webkit-text-fill-color:transparent]',
	firestorm: 'bg-linear-to-r/srgb from-school-fire to-school-nature bg-clip-text text-primary [-webkit-text-fill-color:transparent]',
	elemental: 'bg-linear-to-r/srgb from-school-frost via-school-nature to-school-fire bg-clip-text text-primary [-webkit-text-fill-color:transparent]',
};

export const SPELL_SCHOOL_BG: Record<string, string> = {
	physical: 'bg-school-physical',
	arcane: 'bg-school-arcane',
	fire: 'bg-school-fire',
	frost: 'bg-school-frost',
	holy: 'bg-school-holy',
	nature: 'bg-school-nature',
	shadow: 'bg-school-shadow',
	chaos: 'bg-school-chaos',
	astral: 'bg-linear-to-r/srgb from-school-nature to-school-arcane',
	shadowflame: 'bg-linear-to-r/srgb from-school-shadow to-school-fire',
	spellfire: 'bg-linear-to-r/srgb from-school-fire to-school-arcane',
	spellfrost: 'bg-linear-to-r/srgb from-school-arcane to-school-frost',
	frostfire: 'bg-linear-to-r/srgb from-school-frost to-school-fire',
	shadowfrost: 'bg-linear-to-r/srgb from-school-shadow to-school-frost',
	plague: 'bg-linear-to-r/srgb from-school-shadow to-school-nature',
	firestorm: 'bg-linear-to-r/srgb from-school-fire to-school-nature',
	elemental: 'bg-linear-to-r/srgb from-school-frost via-school-nature to-school-fire',
};

export const FACTION_TEXT: Record<UIItem_FactionRestriction.HORDE_ONLY | UIItem_FactionRestriction.ALLIANCE_ONLY, string> = {
	[UIItem_FactionRestriction.HORDE_ONLY]: 'text-faction-horde',
	[UIItem_FactionRestriction.ALLIANCE_ONLY]: 'text-faction-alliance',
};

export type ClassCssScheme = 'death-knight' | 'druid' | 'hunter' | 'mage' | 'monk' | 'paladin' | 'priest' | 'rogue' | 'shaman' | 'warlock' | 'warrior';

export const CLASS_TEXT: Record<string, string> = {
	'death-knight': 'text-class-death-knight',
	druid: 'text-class-druid',
	hunter: 'text-class-hunter',
	mage: 'text-class-mage',
	monk: 'text-class-monk',
	paladin: 'text-class-paladin',
	priest: 'text-class-priest',
	rogue: 'text-class-rogue',
	shaman: 'text-class-shaman',
	warlock: 'text-class-warlock',
	warrior: 'text-class-warrior',
};

export const CLASS_BG: Record<string, string> = {
	'death-knight': 'bg-class-death-knight',
	druid: 'bg-class-druid',
	hunter: 'bg-class-hunter',
	mage: 'bg-class-mage',
	monk: 'bg-class-monk',
	paladin: 'bg-class-paladin',
	priest: 'bg-class-priest',
	rogue: 'bg-class-rogue',
	shaman: 'bg-class-shaman',
	warlock: 'bg-class-warlock',
	warrior: 'bg-class-warrior',
};

export const CLASS_BORDER: Record<string, string> = {
	'death-knight': 'border-class-death-knight',
	druid: 'border-class-druid',
	hunter: 'border-class-hunter',
	mage: 'border-class-mage',
	monk: 'border-class-monk',
	paladin: 'border-class-paladin',
	priest: 'border-class-priest',
	rogue: 'border-class-rogue',
	shaman: 'border-class-shaman',
	warlock: 'border-class-warlock',
	warrior: 'border-class-warrior',
};

export const itemQualityClassName = (quality: ItemQuality | null | undefined): string | undefined => (quality ? QUALITY_TEXT[quality] : undefined);

export const DANGER_TEXT: Record<'safe' | 'warning' | 'danger', string> = {
	safe: 'text-success',
	warning:
		'text-damage-partial [text-shadow:0_0_var(--spacer-2)_var(--color-danger),0_0_var(--spacer-2)_var(--color-danger),0_0_var(--spacer-2)_var(--color-danger)]',
	danger: 'text-danger',
};
