const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const source = fs.readFileSync('static/app.js', 'utf8');
const dmLoader = source.slice(source.indexOf('let dmReloadRequested = false;'), source.indexOf('function appendAdminEmpty'));

function client() {
  const requests = [];
  const context = vm.createContext({
    currentUser: { id: 10 }, selectedDmUser: { id: 1 },
    dmMessagesLoading: false, dmMessageCursor: 0, dmPollSince: '',
    dmFeed: { children: [1], querySelector: () => null, replaceChildren() {} },
    document: { createElement: () => ({}) },
    showDmError() {}, syncReadState() {}, unreadState: {},
    api(url) { return new Promise(resolve => requests.push({ url, resolve })); },
  });
  vm.runInContext(dmLoader, context);
  return { context, requests };
}

test('switching conversations during a load immediately fetches the selected DM', async () => {
  const { context, requests } = client();
  const first = context.loadDmMessages();
  context.selectedDmUser = { id: 2 };
  await context.loadDmMessages();
  assert.equal(requests.length, 1);
  requests[0].resolve({ messages: [], cursor: 50 });
  await first;
  assert.equal(requests.length, 2);
  assert.equal(requests[1].url, '/api/dms/2?after=0');
  assert.equal(context.dmMessageCursor, 0, 'discard the old conversation response');
  requests[1].resolve({ messages: [] });
});

test('a refresh received during a DM fetch is followed immediately', async () => {
  const { context, requests } = client();
  const first = context.loadDmMessages();
  await context.loadDmMessages();
  await context.loadDmMessages();
  requests[0].resolve({ messages: [], cursor: 7 });
  await first;
  assert.equal(requests.length, 2, 'coalesce refreshes into one follow-up');
  assert.equal(requests[1].url, '/api/dms/1?after=7');
  requests[1].resolve({ messages: [] });
});
