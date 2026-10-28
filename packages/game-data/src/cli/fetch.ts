import { readPin, resolveDumpsDir } from "../dumps.ts";

const pin = await readPin();
const dir = await resolveDumpsDir(pin);

console.log(`ao-bin-dumps ${pin.commit} (${pin.date}) is in ${dir}`);
