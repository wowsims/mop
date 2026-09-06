import { LINK_CATEGORY_PARAM, LINK_DEFAULT_CATEGORIES } from '@domain/state/sim_links';
import { Spec } from '@generated/proto/common';

import type { IndividualSimHost } from '../../../sim_host';
import { Importer, ImporterOptions } from '../importer';
// For now this just holds static helpers to match the exporter, so it doesn't extend Importer.
export abstract class IndividualImporter<SpecType extends Spec> extends Importer {
	// Exclude UISettings by default, since most users don't intend to export those.
	static readonly DEFAULT_CATEGORIES = LINK_DEFAULT_CATEGORIES;
	static readonly CATEGORY_PARAM = LINK_CATEGORY_PARAM;

	protected readonly simUI: IndividualSimHost<any>;

	constructor(parent: HTMLElement, simUI: IndividualSimHost<SpecType>, options: ImporterOptions) {
		super(parent, options);
		this.simUI = simUI;
	}
}
