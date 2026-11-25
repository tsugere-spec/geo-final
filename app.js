const get = id => document.getElementById(id);
const key = 'geo-final-v1';
const questions = new Map(data.map(row => [row[0], row]));
const advanced = new Set([
  '1-05','1-08','1-11','1-13','1-15','1-19','1-22','1-23',
  '2-04','2-05','2-06','2-08','2-10','2-12','2-13','2-14','2-15','2-20',
  '3-03','3-06','3-10','3-11','3-12','3-13','3-15','3-16','3-19','3-20','3-21',
  '4-03','4-04','4-05','4-07','4-08','4-09','4-13','4-15','4-17','4-22',
  '5-02','5-03','5-04','5-08','5-10','5-12','5-15','5-16','5-18',
]);
const basic = new Set([
  '1-01','1-02','1-03','1-04','1-06','1-07','1-08','1-09','1-11','1-14','1-16','1-17',
  '2-01','2-02','2-03','2-06','2-07','2-08','2-10','2-11','2-12','2-16','2-17','2-18',
  '3-01','3-02','3-03','3-04','3-05','3-07','3-08','3-09','3-11','3-14','3-18','3-19',
  '4-01','4-02','4-03','4-04','4-06','4-08','4-09','4-10','4-11','4-12','4-18','4-21',
  '5-01','5-02','5-04','5-06','5-07','5-08','5-10','5-11','5-12','5-13','5-17','5-21',
]);
const empty = () => ({ marks: {}, attempts: 0, hits: 0, session: null });
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
let state = empty();
let available = true;
let active = false;

try {
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const previous = JSON.parse(raw);
      state.marks = Object.fromEntries(Object.entries(previous?.marks ?? {})
        .filter(([id, mark]) => questions.has(id) && typeof mark === 'boolean'));
      state.attempts = count(previous?.attempts);
      state.hits = Math.min(count(previous?.hits), state.attempts);
      const s = previous?.session;
      if (Array.isArray(s?.ids) && s.ids.every(id => questions.has(id)) &&
          Number.isInteger(s.pos) && s.pos >= 0 && s.pos < s.ids.length) {
        state.session = s;
        s.missed = Array.isArray(s.missed) ? s.missed.filter(id => s.ids.includes(id)) : [];
        s.sessionHits = Math.min(count(s.sessionHits), s.ids.length);
        s.round = count(s.round) || 1;
        s.stage = ['question', 'revealed', 'graded', 'done'].includes(s.stage) ? s.stage : 'question';
      }
    } catch {
      state = empty();
    }
  }
} catch {
  available = false;
}

function stats() {
  const values = Object.values(state.marks);
  const mastered = values.filter(mark => mark).length;
  get('stats').textContent = `習得 ${mastered} / ${data.length}問 ・ 苦手 ${values.length - mastered}問`;
  get('master').max = data.length;
  get('master').value = mastered;
  const accuracy = state.attempts ? Math.round(100 * state.hits / state.attempts) + '%' : '—';
  get('storage').textContent = `累計正答率 ${accuracy} ・ ${available ? 'このブラウザに保存' : '保存できない環境（今回のみ）'}`;
  get('resume').hidden = active || !state.session || state.session.stage === 'done';
}

function save() {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    available = true;
  } catch {
    available = false;
  }
  stats();
}

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const choiceLabels = { '2-14': '約4割', '4-15': '特定の一次産品の輸出に依存し、国際価格が下落すると国の収入が大きく減るから。' };

function begin(weak = false) {
  const region = get('region').value;
  const difficulty = get('difficulty').value;
  const random = get('shuffle').checked;
  const tier = difficulty === 'basic' ? basic : difficulty === 'advanced' ? advanced : null;
  const ids = Array.from(questions.keys()).filter(id =>
    (region === 'all' || id[0] === region) &&
    (weak ? state.marks[id] === false : !tier || tier.has(id))).sort();
  if (!ids.length) {
    alert('この範囲に苦手問題はありません。');
    return;
  }
  state.session = {
    ids: random ? shuffled(ids) : ids, region, difficulty, random, repeat: get('repeat').checked,
    mode: get('mode').value, pos: 0, sessionHits: 0, missed: [], round: 1, stage: 'question',
  };
  active = true;
  render();
}

function render(moveFocus = true) {
  const s = state.session;
  const [id, prompt, answer, explanation] = questions.get(s.ids[s.pos]);
  const done = s.stage === 'done';
  const graded = s.stage === 'graded';
  const revealed = s.stage === 'revealed';
  const choice = s.mode === 'choice';
  const [first, second, third, comparison, choicePrompt] = choiceBank[id];
  const last = s.pos === s.ids.length - 1;
  const repeat = s.repeat && s.missed.length > 0;

  get('quiz').hidden = done;
  get('done').hidden = !done;
  if (done) {
    get('done').textContent = s.repeat
      ? `学習完了！ 選んだ問題をすべて正解しました（全${s.round}周）。`
      : `学習完了！ ${s.ids.length}問中 ${s.sessionHits}問正解（${Math.round(100 * s.sessionHits / s.ids.length)}%）。`;
    active = false;
    save();
    if (moveFocus) get('done').focus();
    return;
  }

  const region = get('region').querySelector(`option[value="${id[0]}"]`).textContent;
  get('tag').textContent = `${region} ・ ${s.round}周目 ・ ${s.pos + 1} / ${s.ids.length}問`;
  get('progress').max = s.ids.length;
  get('progress').value = s.pos + Number(graded);
  get('question').textContent = choice ? choicePrompt ?? prompt : prompt;
  get('correct').textContent = answer;
  get('explain').textContent = explanation;
  get('compare').textContent = comparison;
  get('compare').hidden = !choice || !graded;
  get('outcome').textContent = graded ? (s.ok ? '正解' : 'もう一度復習') : '解答';
  get('answer').hidden = !graded && !revealed;
  get('grade').hidden = !revealed;
  get('reveal').hidden = choice || graded || revealed;
  get('next').hidden = !graded;
  get('next').textContent = last ? (repeat ? '間違えた問題でもう一周' : '学習結果を見る') : '次の問題';
  get('choices').replaceChildren();
  if (choice) {
    if (s.choiceVersion !== 2 || !Array.isArray(s.options)) {
      s.options = shuffled([answer, first, second, third]);
      s.choiceVersion = 2;
    }
    for (const option of s.options) {
      const button = document.createElement('button');
      button.className = 'choice';
      button.disabled = graded;
      const correct = option === answer;
      const selected = option === s.selected;
      const label = correct ? choiceLabels[id] ?? option : option;
      button.textContent = graded && (correct || selected)
        ? `${label}（${correct ? '正解' : '選んだ答え'}）` : label;
      if (graded && (correct || selected)) button.classList.add(correct ? 'good' : 'bad');
      button.onclick = () => record(correct, option);
      get('choices').append(button);
    }
  }
  save();
  if (moveFocus) get(graded || revealed ? 'answer' : 'question').focus();
}

function record(ok, selected) {
  const s = state.session;
  if (!active || s.stage === 'graded') return;
  const id = s.ids[s.pos];
  state.marks[id] = ok;
  state.attempts++;
  state.hits += Number(ok);
  s.sessionHits += Number(ok);
  if (!ok) s.missed.push(id);
  s.ok = ok;
  s.selected = selected;
  s.stage = 'graded';
  render();
}

get('next').onclick = () => {
  const s = state.session;
  if (!active || s.stage !== 'graded') return;
  if (s.pos + 1 < s.ids.length) {
    s.pos++;
  } else if (s.repeat && s.missed.length) {
    s.ids = s.random ? shuffled(s.missed) : s.missed;
    s.pos = 0;
    s.missed = [];
    s.sessionHits = 0;
    s.round++;
  } else {
    s.stage = 'done';
    render();
    return;
  }
  s.stage = 'question';
  delete s.options;
  delete s.selected;
  render();
};
get('reveal').onclick = () => {
  state.session.stage = 'revealed';
  render();
};
get('wrong').onclick = () => record(false);
get('right').onclick = () => record(true);
get('start').onclick = () => begin();
get('review').onclick = () => begin(true);
get('resume').onclick = () => {
  const s = state.session;
  if (!s || s.stage === 'done') return;
  get('region').value = s.region ?? 'all';
  get('mode').value = s.mode;
  get('difficulty').value = s.difficulty ?? 'standard';
  get('repeat').checked = Boolean(s.repeat);
  get('shuffle').checked = s.random ?? true;
  active = true;
  render();
};
get('reset').onclick = () => {
  if (!confirm('すべての学習履歴を消去しますか？')) return;
  state = empty();
  active = false;
  get('quiz').hidden = true;
  get('done').hidden = true;
  save();
};
stats();
