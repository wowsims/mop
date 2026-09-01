import { tryParseUrlLocation, UrlParseData } from '../../../state/sim_links';

// For now this just holds static helpers to match the exporter, so it doesn't extend Importer.
export class IndividualLinkImporter {
	static tryParseUrlLocation(location: Location | URL): UrlParseData | null {
		return tryParseUrlLocation(location);
	}
}
