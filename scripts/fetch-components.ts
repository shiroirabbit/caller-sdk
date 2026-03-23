import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'generated');
const OUT_FILE = path.join(OUT_DIR, 'components.json');

dotenv.config({ path: path.join(ROOT, '.env') });

async function fetchComponents() {
  const baseUrl = process.env.PUBLIC_BASE_API_URL;

  if (!baseUrl) {
    console.error('PUBLIC_BASE_API_URL not found in .env');
    process.exit(1);
  }

  const client = axios.create({
    baseURL: baseUrl.replace(/\/+$/, ''),
  });

  console.log(`Fetching components from ${baseUrl}...`);

  const { data } = await client.get('/v1/system/components');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');

  console.log(`Saved components to ${path.relative(ROOT, OUT_FILE)}`);
}

fetchComponents();
