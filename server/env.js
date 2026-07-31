import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Always load the backend environment relative to this file. Existing process
// variables (for example, values supplied by production hosting) take priority.
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });
