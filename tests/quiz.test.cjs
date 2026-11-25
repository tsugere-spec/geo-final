const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const read = file => readFileSync(join(__dirname, '..', file), 'utf8');
const scripts = ['questions.js', 'choices.js', 'app.js'].map(read).join('\n');
let stored;

function open() {
  const elements = new Map();
  const element = () => ({
    children: [],
    classList: { add() {} },
    focus() {},
    querySelector() { return { textContent: '地域' }; },
    replaceChildren() { this.children = []; },
    append(child) { this.children.push(child); },
  });
  const get = id => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  get('region').value = 'all';
  get('mode').value = 'choice';
  get('difficulty').value = 'standard';
  get('shuffle').checked = false;
  get('repeat').checked = true;
  const bank = vm.runInNewContext(scripts + '\n;({data, choiceBank, basic, advanced, choiceLabels})', {
    document: { getElementById: get, createElement: element },
    localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; } },
    alert() { assert.fail('Unexpected empty question set'); },
    confirm: () => true,
  });
  return { get, bank };
}

let { get, bank } = open();
const state = () => JSON.parse(stored);
const ids = new Set(bank.data.map(row => row[0]));
assert.equal(bank.data.length, 110);
assert.equal(ids.size, 110);
assert.deepEqual(new Set(Object.keys(bank.choiceBank)), ids);
for (const [id, prompt, answer, explanation] of bank.data) {
  const [a, b, c, comparison, choicePrompt] = bank.choiceBank[id];
  assert([prompt, answer, explanation, a, b, c, comparison].every(text => text.trim()), id);
  const options = [bank.choiceLabels[id] ?? answer, a, b, c];
  assert.equal(new Set(options).size, 4, id);
  for (const option of options) {
    assert(!(choicePrompt ?? prompt).includes(option), `${id} repeats the option "${option}"`);
  }
}
assert.equal(bank.basic.size, 60);
assert.equal(bank.advanced.size, 48);
for (const tier of [bank.basic, bank.advanced]) {
  assert([...tier].every(id => ids.has(id)));
  assert.equal(new Set([...tier].map(id => id[0])).size, 5);
}

get('start').onclick();
const positions = new Set();
for (let i = 0; i < bank.data.length; i++) {
  const current = state().session;
  const [id, , answer] = bank.data.find(row => row[0] === current.ids[i]);
  const options = get('choices').children;
  assert.equal(options.length, 4, id);
  const correct = current.options.indexOf(answer);
  positions.add(correct);
  options[i === 0 ? (correct + 1) % 4 : correct].onclick();
  assert.equal(get('compare').hidden, false, id);
  assert.equal(get('compare').textContent, bank.choiceBank[id][3]);
  if (i === 0) {
    ({ get } = open());
    get('resume').onclick();
    assert.deepEqual(state().session.options, current.options);
    assert.equal(get('answer').hidden, false);
    assert.equal(state().attempts, 1);
  }
  get('next').onclick();
}
assert(positions.size > 1);
assert.deepEqual(state().session.ids, ['1-01']);
assert.equal(state().session.round, 2);
get('choices').children[state().session.options.indexOf('ムスリム')].onclick();
get('next').onclick();
assert.equal(get('master').value, 110);
assert.equal(state().attempts, 111);
assert.equal(get('done').hidden, false);

get('difficulty').value = 'advanced';
get('region').value = '3';
get('start').onclick();
assert.deepEqual(state().session.ids, [...bank.advanced].filter(id => id[0] === '3').sort());
get('difficulty').value = 'basic';
get('start').onclick();
assert.deepEqual(state().session.ids, [...bank.basic].filter(id => id[0] === '3').sort());
get('region').value = 'all';
get('mode').value = 'flash';
get('difficulty').value = 'standard';
get('shuffle').checked = true;
get('start').onclick();
const randomIds = state().session.ids;
assert.deepEqual(new Set(randomIds), ids);
assert.notDeepEqual(randomIds, [...randomIds].sort());
get('reveal').onclick();
({ get } = open());
get('resume').onclick();
assert.equal(get('grade').hidden, false);
get('wrong').onclick();
get('review').onclick();
assert.deepEqual(state().session.ids, [randomIds[0]]);

stored = '{"marks":{"1-01":false},"attempts":1,"hits":0,"session":{"ids":["1-01"],"pos":0,"mode":"flash","sessionHits":0}}';
({ get } = open());
get('resume').onclick();
assert.equal(state().attempts, 1);
assert.equal(get('question').textContent, bank.data[0][1]);
stored = '{';
({ get } = open());
assert.equal(get('master').value, 0);
console.log('PASS: 110 questions, 330 distractors, difficulty, scoring, retries, resume, and legacy history.');
