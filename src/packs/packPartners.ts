import { dependencySatisfied } from "./packCompatibility";
import type { PackManifest, PackVersion } from "./packManifest";

export const PARTNER_FILE_LIMIT = 4;

export interface PackRequirement {
	uuid: string;
	version: PackVersion | null;
}

export interface PartnerWalk<File> {
	candidates: PackManifest[];
	installed: Map<string, PackVersion>;
	files: File[];
	open(file: File): Promise<PackManifest[] | null>;
	drop(file: File): Promise<void>;
}

export const unmetRequirements = (
	candidates: PackManifest[],
	installed: Map<string, PackVersion>,
): PackRequirement[] => {
	const present = new Map(installed);
	for (const manifest of candidates) {
		present.set(manifest.uuid, manifest.version);
	}
	return candidates.flatMap((manifest) =>
		manifest.requirements.flatMap((requirement) =>
			requirement.uuid === null || dependencySatisfied(present.get(requirement.uuid), requirement.version)
				? []
				: [
						{
							uuid: requirement.uuid,
							version: requirement.version,
						},
					],
		),
	);
};

export const keepsPartner = (unmet: PackRequirement[], candidates: PackManifest[], partner: PackManifest[]) => {
	const taken = new Set(candidates.map((manifest) => manifest.uuid));
	return (
		partner.every((manifest) => !taken.has(manifest.uuid))
		&& unmet.some((requirement) =>
			partner.some(
				(manifest) => manifest.uuid === requirement.uuid && dependencySatisfied(manifest.version, requirement.version),
			),
		)
	);
};

export const walkPartnerFiles = async <File>(walk: PartnerWalk<File>): Promise<File[]> => {
	const kept: File[] = [];
	const candidates = [
		...walk.candidates,
	];
	let downloads = 0;
	for (const file of walk.files) {
		const unmet = unmetRequirements(candidates, walk.installed);
		if (unmet.length === 0 || downloads >= PARTNER_FILE_LIMIT) {
			break;
		}
		const partner = await walk.open(file);
		if (partner === null) {
			continue;
		}
		downloads += 1;
		if (keepsPartner(unmet, candidates, partner)) {
			kept.push(file);
			candidates.push(...partner);
		} else {
			await walk.drop(file);
		}
	}
	return kept;
};
