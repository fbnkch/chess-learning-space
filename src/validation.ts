import { z } from "zod";

// The browser CSP forbids eval. Skip Zod's JIT feature probe and use its
// normal interpreter so validation never emits a CSP violation at startup.
z.config({ jitless: true });
