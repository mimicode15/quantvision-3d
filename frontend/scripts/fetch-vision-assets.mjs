// Puts MediaPipe's runtime files where the browser can load them from your own origin:
//   public/mediapipe/wasm/*             copied from node_modules (no network needed)
//   public/models/hand_landmarker.task  downloaded once from Google's model bucket (~8 MB)
// Run with: npm run setup-vision   (also runs automatically before `npm run build`)
import {
  cpSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wasmSrc = path.join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDst = path.join(root, "public/mediapipe/wasm");
const modelDst = path.join(root, "public/models/hand_landmarker.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MIN_MODEL_BYTES = 1_000_000; // sanity check: a real model is several MB, an error page is not

function fail(message) {
  console.error(`setup-vision: ${message}`);
  process.exit(1);
}

// 1) wasm runtime
if (!existsSync(wasmSrc))
  fail("@mediapipe/tasks-vision is not installed. Run `npm install` first.");
mkdirSync(wasmDst, { recursive: true });
cpSync(wasmSrc, wasmDst, { recursive: true });
console.log("setup-vision: wasm runtime copied to public/mediapipe/wasm");

// 2) hand model
if (existsSync(modelDst) && statSync(modelDst).size >= MIN_MODEL_BYTES) {
  console.log("setup-vision: hand model already present");
} else {
  console.log("setup-vision: downloading hand model…");
  let bytes;
  try {
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    fail(
      `couldn't download the model (${error instanceof Error ? error.message : error}).\n` +
        `  Download it manually from:\n  ${MODEL_URL}\n  and save it as frontend/public/models/hand_landmarker.task`,
    );
  }
  if (bytes.length < MIN_MODEL_BYTES) fail(`downloaded file is too small (${bytes.length} bytes).`);
  mkdirSync(path.dirname(modelDst), { recursive: true });
  const tmp = `${modelDst}.part`;
  rmSync(tmp, { force: true });
  writeFileSync(tmp, bytes);
  renameSync(tmp, modelDst); // never leave a half-written model behind
  console.log(`setup-vision: model saved (${(bytes.length / 1e6).toFixed(1)} MB)`);
}
