const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const source = fs.readFileSync('static/app.js', 'utf8');
const dmLoader = source.slice(source.indexOf('let dmReloadRequested = false;'), source.indexOf('function appendAdminEmpty'));

test('tapping Send keeps the active chat keyboard open', () => {
  const dismissal = source.slice(
    source.indexOf('function dismissKeyboardOutsideInput'),
    source.indexOf('document.addEventListener("pointerdown", dismissKeyboardOutsideInput)'),
  );
  const worldInput = {};
  const dmInput = {};
  const worldSendIcon = { closest: () => null };
  const dmSendIcon = { closest: () => null };
  let dismissals = 0;
  const context = vm.createContext({
    keyboardInput: worldInput,
    mobileKeyboard: { contains: () => false },
    keyboardSendButtons: new Map([
      [worldInput, { contains: target => target === worldSendIcon }],
      [dmInput, { contains: target => target === dmSendIcon }],
    ]),
    hideMobileKeyboard() { dismissals++; },
  });
  vm.runInContext(dismissal, context);

  context.dismissKeyboardOutsideInput({ target: worldSendIcon });
  context.keyboardInput = dmInput;
  context.dismissKeyboardOutsideInput({ target: dmSendIcon });
  assert.equal(dismissals, 0);

  context.dismissKeyboardOutsideInput({ target: worldSendIcon });
  assert.equal(dismissals, 1);
});

function client() {
  const requests = [];
  const context = vm.createContext({
    currentUser: { id: 10 }, selectedDmUser: { id: 1 }, selectedDmGroup: null,
    dmMessagesLoading: false, dmMessageCursor: 0, dmPollSince: '',
    loadGroupMessages() {},
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

test('custom keyboard edits single-line fields with and without a length limit', () => {
  const editing = source.slice(
    source.indexOf('function composerSnapshot'),
    source.indexOf('async function pasteWithMobileKeyboard'),
  );
  const context = vm.createContext({ Event });
  vm.runInContext(editing, context);

  const input = {
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    maxLength: -1,
    events: [],
    setRangeText(value, start, end) {
      this.value = this.value.slice(0, start) + value + this.value.slice(end);
      this.selectionStart = this.selectionEnd = start + value.length;
    },
    dispatchEvent(event) { this.events.push(event); },
  };
  context.editWithMobileKeyboard(input, 'insert', 'A');
  assert.equal(input.value, 'A');
  assert.equal(input.events[0].type, 'input');
  assert.equal(input.events[0].bubbles, true);

  input.maxLength = 2;
  context.editWithMobileKeyboard(input, 'insert', 'BC');
  assert.equal(input.value, 'A');
  input.selectionStart = 0;
  context.editWithMobileKeyboard(input, 'insert', 'BC');
  assert.equal(input.value, 'BC');
});

test('install guide defaults to the detected device and browser', () => {
  const detection = source.slice(
    source.indexOf('function defaultInstallGuide'),
    source.indexOf('function renderInstallGuide'),
  );
  const context = vm.createContext({});
  vm.runInContext(detection, context);
  const detect = context.defaultInstallGuide;

  assert.equal(detect('iPhone Safari/604', 'iPhone', 5), 'ios');
  assert.equal(detect('Macintosh Safari/604', 'MacIntel', 5), 'ios');
  assert.equal(detect('Android Chrome/130', 'Linux armv8l', 5), 'android');
  assert.equal(detect('Macintosh Safari/604', 'MacIntel', 0), 'mac');
  assert.equal(detect('Chrome/130 Edg/130', 'Win32', 0), 'edge');
  assert.equal(detect('Macintosh Chrome/130 Safari/537', 'MacIntel', 0), 'chrome');
});
