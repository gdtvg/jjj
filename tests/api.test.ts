import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/game.mts';

test('session endpoint sets a private cookie and preserves the public player identity', async () => {
  const response = await handler(new Request('https://example.com/.netlify/functions/game', {
    method: 'POST', body: JSON.stringify({ event: 'session' }),
  }));
  const cookie = response.headers.get('set-cookie')!;
  assert.ok(cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict') && cookie.includes('Secure'));
  const first = await response.json();
  const resumed = await handler(new Request('https://example.com/.netlify/functions/game', {
    method: 'POST', headers: { cookie: cookie.split(';')[0] }, body: JSON.stringify({ event: 'session' }),
  }));
  const second = await resumed.json();
  assert.equal(first.success, true);
  assert.equal(first.playerId === second.playerId, true);
  assert.equal(resumed.headers.has('set-cookie'), false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('cross-origin commands are refused before accessing the database', async () => {
  const response = await handler(new Request('https://example.com/.netlify/functions/game', {
    method: 'POST', headers: { origin: 'https://another.example' }, body: JSON.stringify({ event: 'lobby:create' }),
  }));
  assert.equal(response.status, 403);
});
