"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./db");
const migrations_1 = require("./db/migrations");
const ipAllowlist_1 = require("./middleware/ipAllowlist");
const validateSecrets_1 = require("./validateSecrets");
const auth_1 = __importDefault(require("./routes/auth"));
const nodes_1 = __importDefault(require("./routes/nodes"));
const proxies_1 = __importDefault(require("./routes/proxies"));
const allProxies_1 = __importDefault(require("./routes/allProxies"));
const audit_1 = __importDefault(require("./routes/audit"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const search_1 = __importDefault(require("./routes/search"));
const templates_1 = __importDefault(require("./routes/templates"));
const backupStatus_1 = __importDefault(require("./routes/backupStatus"));
const exportCsv_1 = __importDefault(require("./routes/exportCsv"));
const nodeHealthPoller_1 = require("./services/nodeHealthPoller");
const config_1 = require("./config");
const app = (0, express_1.default)();
if (config_1.config.trustProxy) {
    app.set('trust proxy', 1);
}
app.use((0, cors_1.default)());
app.use(ipAllowlist_1.ipAllowlistMiddleware);
app.use(express_1.default.json());
app.use('/api/auth', auth_1.default);
app.use('/api/nodes', nodes_1.default);
app.use('/api/nodes', proxies_1.default);
app.use('/api/proxies', allProxies_1.default);
app.use('/api/audit', audit_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/search', search_1.default);
app.use('/api/proxy-templates', templates_1.default);
app.use('/api/backup', backupStatus_1.default);
app.use('/api/export', exportCsv_1.default);
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});
app.get('/api/ready', async (_req, res) => {
    try {
        await db_1.pool.query('SELECT 1');
        res.json({ status: 'ready', database: 'ok' });
    }
    catch (e) {
        res.status(503).json({ status: 'not_ready', database: 'error', error: e?.message || 'db' });
    }
});
async function bootstrap() {
    try {
        (0, validateSecrets_1.assertStrongSecrets)();
        await (0, migrations_1.runMigrations)();
        const adminUser = process.env.ADMIN_USERNAME;
        const adminPass = process.env.ADMIN_PASSWORD;
        if (adminUser && adminPass) {
            await (0, migrations_1.createAdminUser)(adminUser, adminPass);
        }
        (0, nodeHealthPoller_1.startNodeHealthPoller)();
        app.listen(config_1.config.port, '0.0.0.0', () => {
            console.log(`Panel backend running on port ${config_1.config.port}`);
        });
    }
    catch (error) {
        console.error('Failed to start panel backend:', error);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=index.js.map