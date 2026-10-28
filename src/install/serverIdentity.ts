import { generateKeyPairSync } from "node:crypto";
import type { Bridge } from "@serverkgg/bridge";
import { SERVER_IDENTITY_DIRECTORY, SERVER_IDENTITY_KEY_FILE } from "../shared";

export const SERVER_IDENTITY_CURVE = "secp384r1";

export const serverIdentityKey = () => {
	const { privateKey } = generateKeyPairSync("ec", {
		namedCurve: SERVER_IDENTITY_CURVE,
	});

	return privateKey
		.export({
			type: "sec1",
			format: "pem",
		})
		.toString();
};

export const seedServerIdentity = async (context: Bridge.Context) => {
	if (await context.files.exists(SERVER_IDENTITY_KEY_FILE)) {
		return;
	}

	await context.files.ensure(SERVER_IDENTITY_DIRECTORY);
	await context.files.write(SERVER_IDENTITY_KEY_FILE, serverIdentityKey());

	context.log("saved a server identity key, so players accept the server once instead of after every start", {
		file: SERVER_IDENTITY_KEY_FILE,
	});
};
