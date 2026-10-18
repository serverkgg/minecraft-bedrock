export const versionParts = (version: string) => version.split(".").map(Number);

export const compareVersion = (a: number[], b: number[]) => {
	for (let index = 0; index < Math.max(a.length, b.length); index++) {
		const difference = (a[index] ?? 0) - (b[index] ?? 0);
		if (difference !== 0) {
			return Math.sign(difference);
		}
	}
	return 0;
};
