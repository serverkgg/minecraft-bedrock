import { describe, expect, it } from "bun:test";
import { createPrivateKey } from "node:crypto";
import type { Bridge } from "@serverkgg/bridge";
import { SERVER_IDENTITY_DIRECTORY, SERVER_IDENTITY_KEY_FILE } from "../shared";
import { SERVER_IDENTITY_CURVE, seedServerIdentity, serverIdentityKey } from "./serverIdentity";

const EXISTING_KEY = "-----BEGIN EC PRIVATE KEY-----\nthe owner's own key\n-----END EC PRIVATE KEY-----\n";

const identityOf = (initial: Record<string, string>) => {
	const files = new Map(Object.entries(initial));
	const ensured: string[] = [];
	const logs: string[] = [];
	const context = {
		files: {
			exists: async (path: string) => files.has(path),
			ensure: async (...paths: string[]) => {
				ensured.push(...paths);
			},
			write: async (path: string, content: string) => {
				files.set(path, content);
			},
		},
		log: (message: string) => {
			logs.push(message);
		},
	} as unknown as Bridge.Context;

	return {
		context,
		files,
		ensured,
		logs,
	};
};

describe("serverIdentityKey", () => {
	it("writes an unencrypted p-384 key in the sec1 pem bedrock loads", () => {
		const pem = serverIdentityKey();
		const key = createPrivateKey(pem);

		expect(pem.startsWith("-----BEGIN EC PRIVATE KEY-----\n")).toBe(true);
		expect(key.asymmetricKeyType).toBe("ec");
		expect(key.asymmetricKeyDetails?.namedCurve).toBe(SERVER_IDENTITY_CURVE);
	});

	it("gives every server its own key", () => {
		expect(serverIdentityKey()).not.toBe(serverIdentityKey());
	});
});

describe("seedServerIdentity", () => {
	it("saves a key where bedrock looks for it when the server has none", async () => {
		const run = identityOf({});

		await seedServerIdentity(run.context);

		expect(run.ensured).toEqual([
			SERVER_IDENTITY_DIRECTORY,
		]);
		expect(createPrivateKey(run.files.get(SERVER_IDENTITY_KEY_FILE) ?? "").asymmetricKeyDetails?.namedCurve).toBe(
			SERVER_IDENTITY_CURVE,
		);
		expect(run.logs).toEqual([
			"saved a server identity key, so players accept the server once instead of after every start",
		]);
	});

	it("keeps the saved key on every later boot, so players never accept the server again", async () => {
		const run = identityOf({});

		await seedServerIdentity(run.context);
		const first = run.files.get(SERVER_IDENTITY_KEY_FILE);
		await seedServerIdentity(run.context);

		expect(run.files.get(SERVER_IDENTITY_KEY_FILE)).toBe(first);
		expect(run.logs).toHaveLength(1);
	});

	it("never replaces a key the owner brought from another host", async () => {
		const run = identityOf({
			[SERVER_IDENTITY_KEY_FILE]: EXISTING_KEY,
		});

		await seedServerIdentity(run.context);

		expect(run.files.get(SERVER_IDENTITY_KEY_FILE)).toBe(EXISTING_KEY);
		expect(run.ensured).toEqual([]);
		expect(run.logs).toEqual([]);
	});
});
