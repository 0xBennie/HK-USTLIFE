import { loadLocalConfig } from './config.js';
import { seedDevelopmentAccounts } from './seed.js';

seedDevelopmentAccounts(loadLocalConfig(process.env).dataDir);
console.log('Local demo accounts ready: admin@example.test, student-a@example.test, student-b@example.test. Use the local email-code flow; no passwords or emails are sent.');
