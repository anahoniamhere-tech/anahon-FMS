#!/usr/bin/env node
/**
 * Turn a 2-hour Graph Explorer token into a Page token that never expires.
 *
 * This is the step that was missing last time: the tokens in the archive .env
 * were raw Explorer tokens, so they died the same afternoon. The exchange below
 * is the documented way out —
 *
 *   short-lived user token  --(app secret)-->  long-lived user token (60 days)
 *   long-lived user token   --(/me/accounts)-->  PAGE token (no expiry)
 *
 * Page tokens derived from a long-lived user token do not expire. They only
 * break if the password changes, the app is removed, or Meta revokes them.
 *
 * Usage:
 *   node scripts/meta-token.mjs <short-lived-user-token>
 *
 * Needs META_APP_ID and META_APP_SECRET in AnaHon-Financial-Management-System/.env
 * (App Dashboard -> Settings -> Basic). Writes META_PAGE_TOKEN + META_PAGE_ID
 * back into that .env. The .env is gitignored and must stay that way.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const G = 'https://graph.facebook.com/v25.0';
const ENV = new URL('../.env', import.meta.url);

const readEnv = () => (existsSync(ENV) ? readFileSync(ENV, 'utf-8') : '');
const get = (k) => (readEnv().match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').trim().replace(/^["']|["']$/g, '');

const setKeys = (pairs) => {
  let txt = readEnv();
  for (const [k, v] of Object.entries(pairs)) {
    txt = new RegExp(`^${k}=.*$`, 'm').test(txt)
      ? txt.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`)
      : `${txt}${txt.endsWith('\n') || !txt ? '' : '\n'}${k}=${v}\n`;
  }
  writeFileSync(ENV, txt);
};

const call = async (path, params) => {
  const url = new URL(G + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const j = await (await fetch(url)).json();
  if (j.error) throw new Error(`${j.error.message} (code ${j.error.code})`);
  return j;
};

const short = process.argv[2];
if (!short) {
  console.error('usage: node scripts/meta-token.mjs <short-lived-user-token>');
  console.error('get one at developers.facebook.com/tools/explorer with these permissions:');
  console.error('  pages_show_list  pages_read_engagement  pages_manage_posts');
  console.error('  instagram_basic  instagram_content_publish');
  process.exit(1);
}

const APP_ID = get('META_APP_ID');
const APP_SECRET = get('META_APP_SECRET');
if (!APP_ID || !APP_SECRET) {
  console.error('missing META_APP_ID / META_APP_SECRET in AnaHon-Financial-Management-System/.env');
  console.error('find them at developers.facebook.com -> your app -> Settings -> Basic');
  process.exit(1);
}

console.log('1/3  exchanging for a long-lived user token…');
const long = await call('/oauth/access_token', {
  grant_type: 'fb_exchange_token',
  client_id: APP_ID,
  client_secret: APP_SECRET,
  fb_exchange_token: short,
});
console.log(`     ok — valid ~${Math.round((long.expires_in ?? 5184000) / 86400)} days`);

console.log('2/3  fetching the Page token…');
const accounts = await call('/me/accounts', {
  access_token: long.access_token,
  fields: 'id,name,access_token,tasks',
});
if (!accounts.data?.length) throw new Error('this user manages no Pages — check the account used to log in');

const page = accounts.data.find((p) => /ana\s*hon|anahon/i.test(p.name)) ?? accounts.data[0];
if (accounts.data.length > 1) {
  console.log('     pages visible:', accounts.data.map((p) => `${p.name} (${p.id})`).join(', '));
}
console.log(`     using: ${page.name} (${page.id})`);
if (!page.tasks?.includes('CREATE_CONTENT')) {
  console.log('     WARNING: this token cannot CREATE_CONTENT on the page — publishing will fail');
}

console.log('3/3  verifying the Page token…');
const dbg = await call('/debug_token', { input_token: page.access_token, access_token: page.access_token });
const d = dbg.data ?? {};
console.log(`     expires: ${d.expires_at ? new Date(d.expires_at * 1000).toISOString() : 'never'}`);
console.log(`     scopes : ${(d.scopes ?? []).join(', ')}`);

const need = ['pages_manage_posts', 'instagram_content_publish'];
const missing = need.filter((s) => !(d.scopes ?? []).includes(s));
if (missing.length) console.log(`     MISSING: ${missing.join(', ')} — re-generate the Explorer token with those ticked`);

setKeys({ META_PAGE_TOKEN: page.access_token, META_PAGE_ID: page.id });
console.log('\nwritten to AnaHon-Financial-Management-System/.env — open the Social desk in the FMS.');
