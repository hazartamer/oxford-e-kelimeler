// ---------- Veri ve kayıt ----------
const W = WORDS.map((a, i) => ({ i, w: a[0], pos: a[1], lv: a[2], tr: a[3], ant: a[4], antTr: a[5], ex: a[6] }));
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let prog = store.get('oxe.prog', {});            // { kelime: kutu 0..5 }
let meta = store.get('oxe.meta', { xp: 0, streak: 0, last: '', level: '' });
const MAXBOX = 5;
const $ = (s) => document.querySelector(s);
const view = $('#view');
const box = (x) => prog[x.w] || 0;
const today = () => new Date().toISOString().slice(0, 10);
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pool = () => W.filter((x) => !meta.level || x.lv === meta.level);
const antPool = () => pool().filter((x) => x.ant);

function mark(x, ok) {
  prog[x.w] = ok ? Math.min(MAXBOX, box(x) + 1) : Math.max(0, box(x) - 1);
  if (ok) meta.xp += 10;
  const t = today();
  if (meta.last !== t) {
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    meta.streak = meta.last === y ? meta.streak + 1 : 1;
    meta.last = t;
  }
  store.set('oxe.prog', prog); store.set('oxe.meta', meta); hud();
}
function hud() { $('#streak').textContent = meta.streak; $('#xp').textContent = meta.xp; }
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.rate = 0.9;
  speechSynthesis.speak(u);
}
// Zayıf kelimeler önce gelecek şekilde n kelime seç
function pick(list, n) {
  return shuffle(list).sort((a, b) => box(a) - box(b)).slice(0, n);
}
const tags = (x) => `<span class="tag">${x.lv}</span> <span class="tag pos">${x.pos}</span>`;
const spk = (x) => `<button class="icon" data-say="${x.w}" title="Dinle">🔊</button>`;
const progressBar = (i, n) => `<div class="progress"><div style="width:${(i / n) * 100}%"></div></div>`;
const emptyMsg = (msg) => `<div class="panel"><p>${msg}</p><p class="muted">Sağ üstten seviye filtresini değiştirebilirsin.</p></div>`;

let onKey = null; // etkin ekranın klavye dinleyicisi
let timer = null;

// ---------- Ana sayfa ----------
function home() {
  const p = pool();
  const counts = [0, 0, 0];
  p.forEach((x) => { const b = box(x); counts[b === 0 ? 0 : b >= 4 ? 2 : 1]++; });
  const pct = (n) => (p.length ? (n / p.length) * 100 : 0);
  view.innerHTML = `
    <h1>E harfiyle ${p.length} kelime</h1>
    <p class="sub">${antPool().length} tanesinin zıt anlamlısı var. Her doğru cevap kelimeyi bir üst kutuya taşır; 4. kutudan sonrası "öğrenildi" sayılır.</p>
    <div class="panel">
      <div class="bar">
        <div style="width:${pct(counts[2])}%;background:var(--good)"></div>
        <div style="width:${pct(counts[1])}%;background:var(--warn)"></div>
      </div>
      <div class="legend">
        <span><i class="dot" style="background:var(--good)"></i>Öğrenildi: <b>${counts[2]}</b></span>
        <span><i class="dot" style="background:var(--warn)"></i>Çalışılıyor: <b>${counts[1]}</b></span>
        <span><i class="dot" style="background:var(--line)"></i>Yeni: <b>${counts[0]}</b></span>
      </div>
    </div>
    <h2>Nasıl çalışmak istersin?</h2>
    <div class="grid">
      <a class="mode" href="#cards"><i>🃏</i><b>Kartlar</b><span>Çevir, anlamı ve zıt anlamı gör, bildim / bilemedim de.</span></a>
      <a class="mode" href="#quiz"><i>🎯</i><b>Quiz</b><span>4 şıklı: anlam, kelime ya da zıt anlam sor.</span></a>
      <a class="mode" href="#match"><i>🧩</i><b>Eşleştirme</b><span>Kelimeleri zıt anlamlarıyla süreye karşı eşleştir.</span></a>
      <a class="mode" href="#type"><i>⌨️</i><b>Yazma</b><span>Türkçesini gör ya da dinle, İngilizcesini yaz.</span></a>
      <a class="mode" href="#list"><i>📖</i><b>Liste</b><span>Tüm kelimeler, arama ve telaffuz.</span></a>
    </div>
    <p class="muted" style="margin-top:22px"><button id="reset">İlerlemeyi sıfırla</button></p>`;
  $('#reset').onclick = () => {
    if (confirm('Tüm ilerleme silinsin mi?')) { prog = {}; meta.xp = 0; meta.streak = 0; meta.last = ''; store.set('oxe.prog', prog); store.set('oxe.meta', meta); hud(); home(); }
  };
}

// ---------- Kartlar ----------
function cards() {
  const deck = pick(pool(), 15);
  if (!deck.length) return (view.innerHTML = emptyMsg('Bu seviyede kelime yok.'));
  let i = 0, right = 0;
  const show = () => {
    if (i >= deck.length) return done('Kartlar bitti', right, deck.length, '#cards');
    const x = deck[i];
    view.innerHTML = `
      <div class="row between"><h1>Kartlar</h1><span class="muted">${i + 1} / ${deck.length}</span></div>
      ${progressBar(i, deck.length)}
      <div class="flip" id="flip"><div class="flip-in">
        <div class="face"><div>${tags(x)}</div><div class="big">${x.w}</div>${spk(x)}<div class="muted">Çevirmek için tıkla ya da Boşluk'a bas</div></div>
        <div class="face back"><div class="tr">${x.tr}</div>
          ${x.ant ? `<div class="ant">↔ zıt anlam: <b>${x.ant}</b> (${x.antTr})</div>` : ''}
          <div class="ex">${x.ex}</div></div>
      </div></div>
      <div class="row center">
        <button class="bad" id="no">✗ Bilemedim <kbd>1</kbd></button>
        <button class="good" id="yes">✓ Bildim <kbd>2</kbd></button>
      </div>`;
    const flip = () => $('#flip').classList.toggle('open');
    const ans = (ok) => { mark(x, ok); if (ok) right++; i++; show(); };
    $('#flip').onclick = (e) => { if (!e.target.closest('[data-say]')) flip(); };
    $('#no').onclick = () => ans(false);
    $('#yes').onclick = () => ans(true);
    onKey = (e) => {
      if (e.key === ' ') { e.preventDefault(); flip(); }
      if (e.key === '1') ans(false);
      if (e.key === '2') ans(true);
    };
    speak(x.w);
  };
  show();
}

function done(title, right, total, again) {
  onKey = null;
  const pct = Math.round((right / total) * 100);
  view.innerHTML = `<div class="panel" style="text-align:center">
    <div style="font-size:48px">${pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</div>
    <h1>${title}</h1><p class="sub">${total} sorudan <b>${right}</b> doğru (%${pct})</p>
    <div class="row center"><button class="primary" id="again">Tekrar</button><a href="#home"><button>Ana sayfa</button></a></div></div>`;
  $('#again').onclick = () => (location.hash === again ? route() : (location.hash = again));
}

// ---------- Quiz ----------
let quizType = 'en-tr';
function quiz() {
  const types = { 'en-tr': 'İngilizce → Türkçe', 'tr-en': 'Türkçe → İngilizce', ant: 'Zıt anlam' };
  const src = quizType === 'ant' ? antPool() : pool();
  const qs = pick(src, 10);
  const head = `<div class="row between"><h1>Quiz</h1><div class="seg">${Object.entries(types).map(([k, v]) => `<button data-qt="${k}" class="${k === quizType ? 'on' : ''}">${v}</button>`).join('')}</div></div>`;
  const bindSeg = () => view.querySelectorAll('[data-qt]').forEach((b) => (b.onclick = () => { quizType = b.dataset.qt; quiz(); }));
  if (qs.length < 4) { view.innerHTML = head + emptyMsg('Bu seviyede yeterli kelime yok.'); return bindSeg(); }
  const ask = (x) => (quizType === 'en-tr' ? x.w : quizType === 'tr-en' ? x.tr : x.w);
  const ansOf = (x) => (quizType === 'en-tr' ? x.tr : quizType === 'tr-en' ? x.w : x.ant);
  let i = 0, right = 0;
  const show = () => {
    if (i >= qs.length) return done('Quiz bitti', right, qs.length, '#quiz');
    const x = qs[i];
    const others = shuffle((quizType === 'ant' ? W.filter((y) => y.ant) : W).filter((y) => y !== x && ansOf(y) !== ansOf(x) && ansOf(y) !== x.w));
    const seen = new Set([ansOf(x)]);
    const opts = [x];
    for (const y of others) { if (opts.length === 4) break; if (!seen.has(ansOf(y))) { seen.add(ansOf(y)); opts.push(y); } }
    const order = shuffle(opts);
    view.innerHTML = `${head}
      <div class="row between"><span class="muted">Soru ${i + 1} / ${qs.length}</span><span class="muted">Doğru: ${right}</span></div>
      ${progressBar(i, qs.length)}
      <div class="panel">
        <div class="muted">${quizType === 'ant' ? 'Bu kelimenin zıt anlamlısı hangisi?' : quizType === 'en-tr' ? 'Türkçesi hangisi?' : 'İngilizcesi hangisi?'}</div>
        <div class="row" style="margin-top:6px"><div class="big">${ask(x)}</div>${quizType !== 'tr-en' ? spk(x) : ''}</div>
        ${quizType === 'ant' ? `<div class="muted">(${x.tr})</div>` : ''}
        <div class="opts">${order.map((o, k) => `<button data-k="${k}"><kbd>${k + 1}</kbd>${ansOf(o)}</button>`).join('')}</div>
        <div class="fb" id="fb"></div>
      </div>`;
    bindSeg();
    if (quizType !== 'tr-en') speak(x.w);
    let answered = false;
    const next = () => { i++; show(); };
    const choose = (k) => {
      if (answered || !order[k]) return;
      answered = true;
      const ok = order[k] === x;
      mark(x, ok); if (ok) right++;
      view.querySelectorAll('.opts button').forEach((b, n) => {
        b.disabled = true;
        if (order[n] === x) b.classList.add('right'); else if (n === k) b.classList.add('wrong');
      });
      $('#fb').innerHTML = `<div class="row between"><div><b>${ok ? '✓ Doğru!' : '✗ Yanlış.'}</b> ${x.w} = ${x.tr}${x.ant ? ` · zıt: <b>${x.ant}</b>` : ''}<div class="ex">${x.ex}</div></div><button class="primary" id="next">Devam <kbd style="color:inherit">Enter</kbd></button></div>`;
      $('#next').onclick = next;
      if (quizType === 'tr-en') speak(x.w);
    };
    view.querySelectorAll('.opts button').forEach((b) => (b.onclick = () => choose(+b.dataset.k)));
    onKey = (e) => {
      if (answered && e.key === 'Enter') return next();
      if (/^[1-4]$/.test(e.key)) choose(+e.key - 1);
    };
  };
  show();
}

// ---------- Eşleştirme ----------
let matchType = 'ant';
function match() {
  const src = matchType === 'ant' ? antPool() : pool();
  const rightOf = (x) => (matchType === 'ant' ? x.ant : x.tr);
  const set = [];
  const used = new Set();
  for (const x of pick(src, src.length)) { if (set.length === 6) break; if (!used.has(rightOf(x))) { used.add(rightOf(x)); set.push(x); } }
  const head = `<div class="row between"><h1>Eşleştirme</h1><div class="seg">
    <button data-mt="ant" class="${matchType === 'ant' ? 'on' : ''}">Zıt anlam</button>
    <button data-mt="tr" class="${matchType === 'tr' ? 'on' : ''}">Türkçe anlam</button></div></div>`;
  const bindSeg = () => view.querySelectorAll('[data-mt]').forEach((b) => (b.onclick = () => { matchType = b.dataset.mt; match(); }));
  if (set.length < 3) { view.innerHTML = head + emptyMsg('Bu seviyede eşleştirilecek yeterli kelime yok.'); return bindSeg(); }
  const L = shuffle(set), R = shuffle(set);
  let sel = null, left = set.length, miss = 0;
  const t0 = Date.now();
  view.innerHTML = `${head}
    <div class="row between"><span class="muted">Soldan bir kelime, sağdan ${matchType === 'ant' ? 'zıt anlamlısını' : 'Türkçesini'} seç.</span>
    <span class="muted">⏱ <b id="time">0</b> sn · Hata: <b id="miss">0</b></span></div>
    <div class="cols" style="margin-top:14px">
      <div>${L.map((x) => `<button class="tile" data-l="${x.i}">${x.w}</button>`).join('')}</div>
      <div>${R.map((x) => `<button class="tile" data-r="${x.i}">${rightOf(x)}</button>`).join('')}</div>
    </div>`;
  bindSeg();
  timer = setInterval(() => { const el = $('#time'); if (el) el.textContent = Math.floor((Date.now() - t0) / 1000); }, 500);
  view.querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => {
    if (b.classList.contains('done')) return;
    view.querySelectorAll('[data-l]').forEach((o) => o.classList.remove('sel'));
    b.classList.add('sel'); sel = b; speak(b.textContent);
  }));
  view.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => {
    if (!sel || b.classList.contains('done')) return;
    const x = W[+sel.dataset.l];
    if (sel.dataset.l === b.dataset.r) {
      sel.classList.remove('sel'); sel.classList.add('done'); b.classList.add('done');
      mark(x, true); sel = null; left--;
      if (!left) {
        clearInterval(timer);
        const s = Math.floor((Date.now() - t0) / 1000);
        setTimeout(() => {
          view.innerHTML = `<div class="panel" style="text-align:center"><div style="font-size:48px">🧩</div><h1>Tamamlandı!</h1>
            <p class="sub">${s} saniye · ${miss} hata</p>
            <div class="row center"><button class="primary" id="again">Yeni tur</button><a href="#home"><button>Ana sayfa</button></a></div></div>`;
          $('#again').onclick = match;
        }, 500);
      }
    } else {
      miss++; $('#miss').textContent = miss; mark(x, false);
      b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 350);
    }
  }));
}

// ---------- Yazma ----------
function typing() {
  const qs = pick(pool(), 10);
  if (!qs.length) return (view.innerHTML = emptyMsg('Bu seviyede kelime yok.'));
  let i = 0, right = 0;
  const show = () => {
    if (i >= qs.length) return done('Yazma bitti', right, qs.length, '#type');
    const x = qs[i];
    let hints = 1, answered = false;
    const mask = () => x.w.split('').map((c, k) => (c === ' ' ? ' ' : k < hints ? c : '_')).join('');
    view.innerHTML = `
      <div class="row between"><h1>Yazma</h1><span class="muted">${i + 1} / ${qs.length}</span></div>
      ${progressBar(i, qs.length)}
      <div class="panel" style="text-align:center">
        <div>${tags(x)}</div>
        <div class="tr" style="margin:10px 0">${x.tr}</div>
        ${x.ant ? `<div class="muted">zıt anlamlısı: <b>${x.ant}</b></div>` : ''}
        <div class="hint" id="hint" style="margin:14px 0">${mask()}</div>
        <input type="text" class="typebox" id="in" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="İngilizcesini yaz">
        <div class="row center" style="margin-top:14px">
          <button data-say="${x.w}">🔊 Dinle</button><button id="more">💡 Harf ver</button><button class="primary" id="ok">Kontrol et</button>
        </div>
        <div class="fb" id="fb"></div>
      </div>`;
    const input = $('#in'); input.focus();
    $('#more').onclick = () => { if (hints < x.w.length) hints++; $('#hint').textContent = mask(); input.focus(); };
    const check = () => {
      if (answered) { i++; return show(); }
      const v = input.value.trim().toLowerCase();
      if (!v) return;
      answered = true;
      const ok = v === x.w;
      mark(x, ok); if (ok) right++;
      input.disabled = true; $('#hint').textContent = x.w; speak(x.w);
      $('#fb').innerHTML = `<b style="color:var(${ok ? '--good' : '--bad'})">${ok ? '✓ Doğru!' : `✗ Doğrusu: ${x.w}`}</b><div class="ex">${x.ex}</div>`;
      $('#ok').textContent = 'Devam (Enter)'; $('#ok').focus();
    };
    $('#ok').onclick = check;
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.stopPropagation(); check(); } };
    onKey = null;
  };
  show();
}

// ---------- Liste ----------
function list() {
  view.innerHTML = `<h1>Kelime listesi</h1>
    <div class="row" style="margin:10px 0 14px"><input type="text" id="q" placeholder="Ara: kelime ya da anlam" style="flex:1;min-width:180px">
    <label class="muted"><input type="checkbox" id="onlyAnt"> Sadece zıt anlamlısı olanlar</label></div>
    <div class="panel tablewrap"><table><thead><tr><th>Kelime</th><th>Seviye</th><th>Anlam</th><th>Zıt anlam</th><th>Kutu</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const draw = () => {
    const q = $('#q').value.trim().toLowerCase(), only = $('#onlyAnt').checked;
    const rows = pool().filter((x) => (!only || x.ant) && (!q || x.w.includes(q) || x.tr.toLowerCase().includes(q) || x.ant.includes(q)));
    $('#tb').innerHTML = rows.map((x) => `<tr>
      <td class="w">${spk(x)} ${x.w} <span class="muted">${x.pos}</span></td><td><span class="tag">${x.lv}</span></td>
      <td>${x.tr}<div class="ex">${x.ex}</div></td>
      <td>${x.ant ? `<b>${x.ant}</b><div class="muted">${x.antTr}</div>` : '<span class="muted">—</span>'}</td>
      <td class="boxes">${Array.from({ length: MAXBOX }, (_, k) => `<span class="${k < box(x) ? 'f' : ''}"></span>`).join('')}</td></tr>`).join('')
      || '<tr><td colspan="5" class="muted">Sonuç yok.</td></tr>';
  };
  $('#q').oninput = draw; $('#onlyAnt').onchange = draw; draw();
}

// ---------- Yönlendirme ----------
const routes = { home, cards, quiz, match, type: typing, list };
function route() {
  clearInterval(timer); onKey = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  const name = location.hash.slice(1) in routes ? location.hash.slice(1) : 'home';
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + name));
  routes[name]();
  window.scrollTo(0, 0);
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-say]'); if (b) speak(b.dataset.say); });
document.addEventListener('keydown', (e) => { if (onKey && !e.ctrlKey && !e.metaKey && !e.altKey) onKey(e); });
$('#level').value = meta.level || '';
$('#level').onchange = (e) => { meta.level = e.target.value; store.set('oxe.meta', meta); route(); };
window.addEventListener('hashchange', route);
hud(); route();
