import i18n from '../../../../i18n/config';
import { ResourceType } from '../../../proto/spell';

export const dpsColor = '#ed5653';
export const manaColor = '#2E93fA';
export const threatColor = '#b56d07';

export const THREAT_SERIES_NAME = i18n.t('results_tab.details.timeline.tooltips.threat');

export const percentageResources: Array<ResourceType> = [ResourceType.ResourceTypeHealth, ResourceType.ResourceTypeMana];
