import { createRegistry } from "@lonio-poc/engine-core";
import { zhModule } from "@lonio-poc/canton-zh";

/**
 * The single place where canton modules are assembled. Adding a canton to the
 * platform = adding its package + one entry here (see ADR: canton plugin
 * architecture). Imported by both the form (client) and the API (server).
 */
export const cantonRegistry = createRegistry([zhModule]);

export const SWISS_NATIONALITY = "CH";
