"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startQdrant = startQdrant;
exports.ensureQdrantRunning = ensureQdrantRunning;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
let qdrantProcess = null;
const URL_QDRANT = 'http://127.0.0.1:6333';
async function isHealthy() {
    const url = new URL('/healthz', URL_QDRANT);
    return new Promise((resolve) => {
        const req = http_1.default.get(url, (res) => {
            // Qdrant returns 200 OK when healthy
            res.resume();
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
        });
    });
}
async function waitForHealth(timeoutMs = 15000, intervalMs = 500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await isHealthy())
            return;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('Qdrant did not become healthy in time');
}
async function startQdrant() {
    // If already running, return early
    if (await isHealthy())
        return;
    if (qdrantProcess)
        return;
    const exePath = 'E:\\qdrant\\qdrant.exe';
    const configPath = 'E:\\qdrant\\cfg.yml';
    console.log(`Starting Qdrant from ${exePath}`);
    qdrantProcess = (0, child_process_1.spawn)(exePath, ['--config-path', configPath], {
        cwd: path_1.default.dirname(exePath),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });
    qdrantProcess.stdout?.on('data', (d) => console.log('[Qdrant]', d.toString().trim()));
    qdrantProcess.stderr?.on('data', (d) => console.error('[Qdrant ERROR]', d.toString().trim()));
    qdrantProcess.on('exit', (code) => {
        console.log(`[Qdrant exited ${code}]`);
        qdrantProcess = null;
    });
    await waitForHealth();
    console.log('Qdrant is ready');
}
async function ensureQdrantRunning(baseUrl) {
    if (await isHealthy())
        return;
    await startQdrant();
}
// Optional CLI entrypoint
if (require.main === module) {
    startQdrant()
        .then(() => console.log('Qdrant started'))
        .catch((e) => {
        console.error('[FATAL] Failed to start Qdrant:', e?.message || e);
        process.exit(1);
    });
}
//# sourceMappingURL=qdrant-runner.js.map