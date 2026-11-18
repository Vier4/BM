(() => {
  const L = window.BM_LIBRARY;
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view');
  const main = $('#main');

  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="2.5" height="14" rx="1"/><path d="M20 5.5v13a1 1 0 0 1-1.55.83L8.7 12.83a1 1 0 0 1 0-1.66l9.75-6.5A1 1 0 0 1 20 5.5z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><rect x="17.5" y="5" width="2.5" height="14" rx="1"/><path d="M4 5.5v13a1 1 0 0 0 1.55.83l9.75-6.5a1 1 0 0 0 0-1.66L5.55 4.67A1 1 0 0 0 4 5.5z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    add: '<svg viewBox="0 0 24 24"><path d="M3 6h12M3 12h12M3 18h7"/><path d="M18 14v8M14 18h8"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    lyrics: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M8 10h8M8 14h8M8 18h5"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'
  };
  const LICENSE = {
    bm:   { cls: 'bm',   label: '© BM' },
    own:  { cls: 'own',  label: 'Ваш трек' },
    cc0:  { cls: 'free', label: 'CC0' },
    pd:   { cls: 'free', label: 'Общественное достояние' },
    ai:   { cls: 'ai',   label: 'ИИ · Wikimedia' },
    nasa: { cls: 'free', label: 'NASA' }
  };
  const GENRE_HUE = { 'Классика': 32, 'Регтайм и джаз': 195, 'Блюз': 225, 'Народная': 110, 'Оркестр и марши': 0, 'Wikimedia Commons': 280 };
  const GENRE_GLYPH = { 'Классика': '♩', 'Регтайм и джаз': '♫', 'Блюз': '♪', 'Народная': '♬', 'Оркестр и марши': '♫' };

  // Русские запросы → английские названия (для поиска по реальным записям)
  const ALIAS = {
    'бетховен': 'beethoven', 'моцарт': 'mozart', 'бах': 'bach', 'шопен': 'chopin', 'чайковский': 'tchaikovsky',
    'вивальди': 'vivaldi', 'дебюсси': 'debussy', 'сати': 'satie', 'григ': 'grieg', 'шуберт': 'schubert',
    'рахманинов': 'rachmaninoff', 'мусоргский': 'mussorgsky', 'джоплин': 'joplin', 'регтайм': 'ragtime',
    'джаз': 'jazz', 'блюз': 'blues', 'марш': 'march', 'вальс': 'waltz', 'шаляпин': 'chaliapin', 'соуза': 'sousa',
    'симфония': 'symphony', 'соната': 'sonata', 'концерт': 'concerto', 'ноктюрн': 'nocturne', 'прелюдия': 'prelude',
    'фортепиано': 'piano', 'пианино': 'piano', 'скрипка': 'violin', 'оркестр': 'orchestra', 'гимн': 'anthem',
    'космос': 'space', 'марс': 'mars', 'луна': 'moon', 'астронавт': 'astronaut', 'космонавт': 'astronaut',
    'ракета': 'rocket', 'солнце': 'sun', 'земля': 'earth', 'звезда': 'star', 'звёзды': 'stars', 'планета': 'planet',
    'телескоп': 'telescope', 'вебб': 'webb', 'хаббл': 'hubble', 'вояджер': 'voyager', 'самолёт': 'aircraft'
  };

  // ---------- Хранилище ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Не удалось сохранить: память браузера переполнена.'); } }
  };

  const DB = {
    db: null,
    open() {
      return new Promise(res => {
        try {
          const req = indexedDB.open('bm-media', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('tracks', { keyPath: 'id' });
          req.onsuccess = () => { this.db = req.result; res(); };
          req.onerror = () => res();
        } catch (e) { res(); }
      });
    },
    tx(mode, fn) {
      return new Promise(res => {
        try {
          const t = this.db.transaction('tracks', mode);
          const r = fn(t.objectStore('tracks'));
          t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
          t.onerror = () => res(undefined);
        } catch (e) { res(undefined); }
      });
    },
    async get(id) { if (!this.db) return null; return this.tx('readonly', s => s.get(id)); }

  };

  // ---------- Утилиты ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = t => {
    if (!isFinite(t) || t <= 0) return '—';
    t = Math.round(t);
    const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = String(t % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  };
  const fmtDate = d => { const t = Date.parse(d); return isNaN(t) ? '' : new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
  const hashStr = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const decoder = document.createElement('textarea');
  function plainText(s, n = 300) {
    decoder.innerHTML = String(s || '').replace(/<[^>]+>/g, ' '); // textarea не создаёт элементы — безопасно
    const t = decoder.value.replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t;
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // ---------- Данные ----------
  function fromCommons(t) {
    return {
      kind: 'stream', id: t.id, title: t.title, artist: t.artist, src: t.src, ogg: t.ogg || null,
      duration: t.duration, page: t.page, license: /cc0/i.test(t.license) ? 'cc0' : 'pd',
      genre: t.genre || 'Wikimedia Commons', hue: GENRE_HUE[t.genre || 'Wikimedia Commons'] ?? 280
    };
  }
  function episodeItem(show, e) {
    return {
      kind: 'stream', id: 'e-' + hashStr(e.src), title: e.title, artist: show.titleRu, src: e.src,
      duration: e.duration, date: e.date, desc: e.desc, image: show.image, license: 'nasa', show: show.id
    };
  }
  const catalog = (window.BM_CATALOG || []).map(fromCommons);
  const bands = (window.BM_BANDS || []).map(b => ({
    ...b,
    songs: b.songs.map(s => ({
      kind: 'band', id: `bm-${b.id}-${s.id}`, title: s.title, artist: b.name, band: b.id,
      src: `music/bands/${b.id}/${s.id}.mp3`, lyrics: s.lyrics, license: 'bm', hue: b.hue, glyph: b.glyph, genre: 'Группы BM'
    }))
  }));
  const bandSongs = bands.flatMap(b => b.songs);
  const songStatus = {}; // id песни → 'ready' | 'missing' | 'unknown'
  const isMissing = it => it.kind === 'band' && songStatus[it.id] === 'missing';
  // Без подписки BM Премиум закрыты песни групп BM и подкасты
  const isPremiumContent = it => !!it && (it.kind === 'band' || it.license === 'nasa');
  const isLocked = it => isPremiumContent(it) && !isPremium();
  const aiSongs = (window.BM_AI_SONGS || []).map(t => ({
    kind: 'stream', id: t.id, title: t.title, artist: t.artist, lang: t.lang, src: t.src, ogg: t.ogg || null,
    duration: t.duration, page: t.page, license: 'ai', genre: 'Песни от ИИ', hue: t.hue, glyph: '🎤'
  }));
  const GENRES = [...new Set(catalog.map(t => t.genre))];
  const shows = (window.BM_PODCASTS || []).map(s => ({ ...s, episodes: s.episodes.map(e => episodeItem(s, e)) }));

  const state = {
    route: 'home', param: null, query: '',
    queue: [], index: -1, source: null, item: null, playing: false,
    volume: store.get('bm-volume', 0.8),
    userSongSaved: false,
    playlists: store.get('bm-playlists', []),
    durations: store.get('bm-durations', {}),
    genre: 'all', epLimit: 50
  };

  const allMusic = () => [L.userSong, ...bandSongs, ...aiSongs, ...catalog];
  const allEpisodes = () => shows.flatMap(s => s.episodes);
  const glyph = it => it.glyph || (it.genre ? (GENRE_GLYPH[it.genre] || '♫') : '♪');
  const licenseOf = it => isLocked(it) ? { cls: 'lock', label: '🔒 Премиум' }
    : isMissing(it) ? { cls: 'bm soon', label: '© BM · скоро' } : (LICENSE[it.license] || LICENSE.own);
  function durationOf(it) {
    if (it.id === 'user-song' && !state.userSongSaved) return 0;
    return it.duration || state.durations[it.id] || 0;
  }
  function coverHTML(it, size = '') {
    if (it.image) return `<div class="cover ${size} has-img"><img src="${esc(it.image)}" alt="" loading="lazy"></div>`;
    const h = it.hue ?? 260;
    return `<div class="cover ${size}" style="background:linear-gradient(135deg,hsl(${h} 75% 58%),hsl(${(h + 50) % 360} 70% 32%))"><span class="cover-glyph">${esc(glyph(it))}</span></div>`;
  }
  const savePlaylists = () => store.set('bm-playlists', state.playlists);
  const snap = it => JSON.parse(JSON.stringify(it));

  // ---------- Аудио ----------
  const canOgg = !!new Audio().canPlayType('audio/ogg; codecs="vorbis"');
  function streamUrl(it) {
    if (it.ogg && canOgg) return it.ogg;
    const ext = (it.src.split('?')[0].split('.').pop() || '').toLowerCase();
    if (['ogg', 'oga', 'opus'].includes(ext) && !canOgg) return null;
    return it.src;
  }

  class FileSource {
    constructor(item, url) {
      this.item = item;
      this.url = url;
      this.a = new Audio();
      this.a.preload = 'auto';
      this.a.src = url;
      this.onended = null;
      this.onerror = null;
      this.a.addEventListener('ended', () => this.onended && this.onended());
      this.a.addEventListener('error', () => this.onerror && this.onerror('file'));
      this.a.addEventListener('loadedmetadata', () => {
        if (isFinite(this.a.duration) && !item.duration) {
          state.durations[item.id] = this.a.duration;
          store.set('bm-durations', state.durations);
        }
      });
    }
    get duration() { return isFinite(this.a.duration) && this.a.duration ? this.a.duration : durationOf(this.item); }
    get currentTime() { return this.a.currentTime; }
    play(from) {
      if (from != null) { try { this.a.currentTime = from; } catch (e) {} }
      const p = this.a.play();
      if (p && p.catch) p.catch(err => { if (err.name !== 'AbortError' && this.onerror) this.onerror('file'); });
    }
    pause() { this.a.pause(); }
    seek(t) { try { this.a.currentTime = t; } catch (e) {} }
    setVolume(v) { this.a.volume = v; }
    destroy() {
      this.a.pause();
      this.a.removeAttribute('src');
      this.a.load();
      if (this.url && this.url.startsWith('blob:')) URL.revokeObjectURL(this.url);
    }
  }

  async function createSource(item) {
    if (item.kind === 'band') return isMissing(item) ? null : new FileSource(item, item.src);
    if (item.kind === 'stream') {
      const url = streamUrl(item);
      return url ? new FileSource(item, url) : 'format';
    }
    let url = null;
    if (item.blobId) {
      const rec = await DB.get(item.blobId);
      if (rec && rec.blob) url = URL.createObjectURL(rec.blob);
    }
    if (!url) url = item.src || null;
    return url ? new FileSource(item, url) : null;
  }

  // ---------- Плеер ----------
  let playToken = 0;
  async function playFrom(queue, index, force) {
    const item = queue[index];
    if (!item) return;
    if (isLocked(item)) { openPaywall(item); return; }
    if (!force && state.item && state.item.id === item.id && state.source) { toggle(); return; }
    const token = ++playToken;
    stopCurrent();
    state.queue = queue;
    state.index = index;
    state.item = item;
    updatePlayerInfo();
    const src = await createSource(item);
    if (token !== playToken) { if (src && src.destroy) src.destroy(); return; }
    if (src === 'format') {
      toast('Этот формат (OGG) ваш браузер не воспроизводит. Откройте BM в Chrome или Firefox.');
      return;
    }
    if (!src) { handleMissing(item); return; }
    state.source = src;
    src.onended = () => next(true);
    src.onerror = () => {
      if (state.source !== src) return;
      handleMissing(item);
    };
    src.setVolume(state.volume);
    src.play(0);
    setPlaying(true);
  }

  function handleMissing(item) {
    stopCurrent();
    state.item = null;
    updatePlayerInfo();
    if (item.kind === 'band') { songStatus[item.id] = 'missing'; showLyrics(item); toast('Эта песня ещё записывается. Пока можно прочитать текст.'); markCurrent(); }
    else if (item.id === 'user-song') toast('Файла песни пока нет. Положите его в папку music с именем my-song.mp3.');
    else if (item.kind === 'file') toast('Файл этого трека больше не хранится в BM.');
    else toast('Не удалось загрузить запись. Проверьте интернет и попробуйте ещё раз.');
  }

  function stopCurrent() {
    if (state.source) state.source.destroy();
    state.source = null;
    setPlaying(false);
  }

  function toggle() {
    const s = state.source;
    if (!s) {
      if (state.item) { playFrom(state.queue, state.index, true); return; }
      playFrom(state.queue.length ? state.queue : catalog, Math.max(0, state.index), true);
      return;
    }
    if (state.playing) { s.pause(); setPlaying(false); }
    else { s.play(); setPlaying(true); }
  }

  function next(auto) {
    if (!state.queue.length) return;
    let i = state.index + 1;
    while (i < state.queue.length && isLocked(state.queue[i])) i++; // закрытое без подписки пропускаем
    if (i >= state.queue.length) {
      if (auto) { stopCurrent(); state.item = null; updatePlayerInfo(); return; }
      playFrom(state.queue, 0, true);
      return;
    }
    playFrom(state.queue, i, true);
  }

  function prev() {
    if (!state.queue.length) return;
    if (state.source && state.source.currentTime > 3) { state.source.seek(0); return; }
    playFrom(state.queue, Math.max(0, state.index - 1), true);
  }

  function setPlaying(p) {
    state.playing = p;
    document.body.classList.toggle('playing', p);
    $('#b-play').innerHTML = p ? ICON.pause : ICON.play;
    $('#b-play').setAttribute('aria-label', p ? 'Пауза' : 'Играть');
    markCurrent();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = p ? 'playing' : 'paused';
  }

  function updatePlayerInfo() {
    const it = state.item;
    const cover = $('#p-cover');
    $('#b-add').hidden = !it;
    $('#b-lyrics').hidden = !(it && it.lyrics);
    if (!it) {
      $('#p-title').textContent = 'Ничего не играет';
      $('#p-artist').textContent = 'Выберите трек или подкаст';
      cover.outerHTML = '<div class="cover sm" id="p-cover"><span class="cover-glyph">♪</span></div>';
      document.title = 'BM — музыка и подкасты';
    } else {
      $('#p-title').textContent = it.title;
      $('#p-artist').textContent = it.artist;
      cover.outerHTML = coverHTML(it, 'sm').replace('<div class="cover', '<div id="p-cover" class="cover');
      document.title = it.title + ' — BM';
      if ('mediaSession' in navigator && window.MediaMetadata) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: it.title, artist: it.artist, album: 'BM',
          artwork: it.image ? [{ src: it.image, sizes: '512x512' }] : []
        });
      }
    }
    markCurrent();
  }

  function markCurrent() {
    const id = state.item && state.item.id;
    document.querySelectorAll('[data-id]').forEach(el => {
      const cur = el.dataset.id === id;
      el.classList.toggle('is-current', cur);
      el.classList.toggle('is-playing', cur && state.playing);
      const btn = el.querySelector('.card-play');
      if (btn) btn.innerHTML = cur && state.playing ? ICON.pause : ICON.play;
    });
  }

  // Полоса прогресса и громкость
  const seek = $('#seek');
  let dragging = false;
  const paintRange = el => el.style.setProperty('--p', (el.value / el.max * 100) + '%');
  seek.addEventListener('input', () => {
    dragging = true;
    paintRange(seek);
    if (state.source) $('#t-cur').textContent = fmt(seek.value / 1000 * state.source.duration) || '0:00';
  });
  seek.addEventListener('change', () => {
    dragging = false;
    const s = state.source;
    if (s && s.duration) s.seek(seek.value / 1000 * s.duration);
  });
  setInterval(() => {
    if (dragging) return;
    const s = state.source;
    if (!s) { seek.value = 0; paintRange(seek); $('#t-cur').textContent = '0:00'; $('#t-dur').textContent = state.item ? fmt(durationOf(state.item)) : '0:00'; return; }
    const d = s.duration || 0;
    seek.value = d ? Math.min(1000, s.currentTime / d * 1000) : 0;
    paintRange(seek);
    $('#t-cur').textContent = s.currentTime > 0.5 ? fmt(s.currentTime) : '0:00';
    $('#t-dur').textContent = fmt(d);
  }, 250);

  const vol = $('#vol');
  vol.value = Math.round(state.volume * 100);
  paintRange(vol);
  vol.addEventListener('input', () => {
    state.volume = vol.value / 100;
    paintRange(vol);
    if (state.source) state.source.setVolume(state.volume);
    store.set('bm-volume', state.volume);
  });

  $('#b-play').innerHTML = ICON.play;
  $('#b-prev').innerHTML = ICON.prev;
  $('#b-next').innerHTML = ICON.next;
  $('#b-play').addEventListener('click', toggle);
  $('#b-next').addEventListener('click', () => next(false));
  $('#b-prev').addEventListener('click', prev);
  $('#b-add').addEventListener('click', () => state.item && openPicker(state.item));

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => { if (!state.playing) toggle(); });
      navigator.mediaSession.setActionHandler('pause', () => { if (state.playing) toggle(); });
      navigator.mediaSession.setActionHandler('nexttrack', () => next(false));
      navigator.mediaSession.setActionHandler('previoustrack', prev);
    } catch (e) {}
  }

  const anyModalOpen = () => [...document.querySelectorAll('.modal-back')].some(m => !m.hidden);
  document.addEventListener('keydown', e => {
    const typing = /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
    if (e.key === 'Escape') { document.querySelectorAll('.modal-back').forEach(m => { m.hidden = true; }); return; }
    if (typing || anyModalOpen()) return;
    if (e.key === '/') { e.preventDefault(); $('#search').focus(); return; }
    if (e.code === 'Space' && e.target.tagName !== 'BUTTON') { e.preventDefault(); toggle(); }
  });

  // ---------- Шаблоны ----------
  let reg = []; // списки, нарисованные на текущем экране (для очереди воспроизведения)
  const R = items => { reg.push(items); return reg.length - 1; };

  function card(it, k, i) {
    const lic = licenseOf(it);
    return `<div class="card" data-id="${esc(it.id)}" data-list="${k}" data-i="${i}">
      <div class="card-cover">${coverHTML(it)}<button class="card-play" aria-label="Играть">${ICON.play}</button></div>
      <div class="card-title" title="${esc(it.title)}">${esc(it.title)}</div>
      <div class="card-sub">${esc(it.artist)}</div>
      <span class="badge ${lic.cls}">${lic.label}</span>
    </div>`;
  }

  function bandCard(b) {
    return `<div class="card" data-band="${esc(b.id)}">
      <div class="card-cover">${coverHTML(b.songs[0])}</div>
      <div class="card-title">${esc(b.name)}</div>
      <div class="card-sub">${esc(b.genre)} · ${esc(b.city)}</div>
      <span class="badge bm">© BM</span>
    </div>`;
  }

  function showCard(s) {
    return `<div class="card" data-show="${esc(s.id)}">
      <div class="card-cover"><div class="cover has-img"><img src="${esc(s.image)}" alt="" loading="lazy"></div></div>
      <div class="card-title">${esc(s.titleRu)}</div>
      <div class="card-sub">${esc(s.title)} · ${s.total} ${plural(s.total, 'выпуск', 'выпуска', 'выпусков')}</div>
      ${isPremium() ? '<span class="badge free">NASA</span>' : '<span class="badge lock">🔒 Премиум</span>'}
    </div>`;
  }

  function plCover(p, size = '') {
    const imgs = p.items.slice(0, 4);
    return imgs.length >= 4
      ? `<div class="cover collage ${size}">${imgs.map(it => coverHTML(it, 'tile')).join('')}</div>`
      : `<div class="cover ${size}" style="background:linear-gradient(135deg,#7c5cff,#ff5c8a)"><span class="cover-glyph">≡</span></div>`;
  }

  function playlistCard(p) {
    const n = p.items.length;
    return `<div class="card" data-pl="${esc(p.id)}">
      <div class="card-cover">${plCover(p)}</div>
      <div class="card-title">${esc(p.name)}</div>
      <div class="card-sub">${n} ${plural(n, 'трек', 'трека', 'треков')}</div>
    </div>`;
  }

  function row(it, k, i, o = {}) {
    const lic = licenseOf(it);
    const sub = it.show ? `${it.artist}${it.date ? ' · ' + fmtDate(it.date) : ''}` : `${it.artist}${o.genre && it.genre ? ' · ' + it.genre : ''}`;
    return `<div class="row" data-id="${esc(it.id)}" data-list="${k}" data-i="${i}">
      <span class="row-n"><span class="row-n-num">${i + 1}</span><span class="eq"><i></i><i></i><i></i></span></span>
      ${coverHTML(it, 'xs')}
      <div class="row-main">
        <div class="row-title">${esc(it.title)}</div>
        <div class="row-sub">${esc(sub)}</div>
        ${o.desc && it.desc ? `<div class="row-desc">${esc(it.desc)}</div>` : ''}
      </div>
      <span class="badge ${lic.cls}">${lic.label}</span>
      <span class="row-dur">${fmt(durationOf(it))}</span>
      <span class="row-acts">
        ${it.lyrics ? `<button class="row-btn" data-lyrics="${k}:${i}" title="Текст песни" aria-label="Текст песни">${ICON.lyrics}</button>` : ''}
        <button class="row-btn" data-add="${k}:${i}" title="Добавить в плейлист" aria-label="Добавить в плейлист">${ICON.add}</button>
        ${o.unlist ? `<button class="row-btn danger" data-unlist="${i}" title="Убрать из плейлиста" aria-label="Убрать из плейлиста">${ICON.minus}</button>` : ''}
      </span>
    </div>`;
  }

  const list = (items, o) => { const k = R(items); return `<div class="list">${items.map((it, i) => row(it, k, i, o)).join('')}</div>`; };
  const grid = items => { const k = R(items); return `<div class="grid">${items.map((it, i) => card(it, k, i)).join('')}</div>`; };
  const head = (title, sub, actions = '') =>
    `<div class="section-head"><div><h2>${title}</h2>${sub ? `<div class="muted">${sub}</div>` : ''}</div>${actions}</div>`;

  function hero() {
    const s = L.userSong;
    const k = R([s]);
    return `<div class="hero">
      ${coverHTML(s)}
      <div>
        <div class="hero-kicker">Ваш трек</div>
        <h1>${esc(s.title)}</h1>
        <p>Ваша собственная песня.</p>
        <div class="actions">
          <button class="btn primary" data-play="${k}">${ICON.play} Слушать</button>
        </div>
      </div>
    </div>`;
  }

  function featured() {
    const out = [];
    for (let r = 0; out.length < 10 && r < 10; r++) GENRES.forEach(g => {
      const t = catalog.filter(x => x.genre === g)[r];
      if (t && out.length < 10) out.push(t);
    });
    return out;
  }

  const latestEpisodes = n => allEpisodes().sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)).slice(0, n);

  // ---------- Страницы ----------
  const pages = {
    home() {
      return `${hero()}
        <div class="section">
          ${head('Группы BM', isPremium() ? 'Собственные артисты BM. Все песни и тексты © BM' : 'Собственные артисты BM · слушать по бесплатной подписке', '<button class="btn ghost" data-go="bands">Все группы</button>')}
          <div class="grid">${bands.map(bandCard).join('')}</div>
        </div>
        ${state.playlists.length ? `<div class="section">${head('Ваши плейлисты', '', '<button class="btn ghost" data-go="playlists">Все плейлисты</button>')}
          <div class="grid">${state.playlists.slice(0, 6).map(playlistCard).join('')}</div></div>` : ''}
        <div class="section">
          ${head('Песни от ИИ', 'С живым вокалом: созданы нейросетями Suno и Udio', '<button class="btn ghost" data-go="music" data-genre-go="ai">Все песни</button>')}
          ${grid(aiSongs)}
        </div>
        <div class="section">
          ${head('Реальная музыка', `${catalog.length} архивных записей: классика, джаз, блюз, народная музыка`, '<button class="btn ghost" data-go="music">Вся музыка</button>')}
          ${grid(featured())}
        </div>
        <div class="section">
          ${head('Подкасты NASA', isPremium() ? 'Настоящие подкасты космического агентства (на английском)' : 'Настоящие подкасты космического агентства · по бесплатной подписке', '<button class="btn ghost" data-go="podcasts">Все подкасты</button>')}
          <div class="grid">${shows.map(showCard).join('')}</div>
        </div>`;
    },

    music() {
      const chips = [['all', 'Все'], ['bm', 'Группы BM'], ['ai', 'Песни от ИИ'], ...GENRES.map(g => [g, g])];
      const g = state.genre;
      const items = g === 'all' ? allMusic()
        : g === 'ai' ? aiSongs
        : g === 'bm' ? bandSongs
        : catalog.filter(t => t.genre === g);
      const k = R(items);
      return `<h1>Музыка</h1>
        <p class="muted">Группы BM, песни с ИИ-вокалом и архивные записи. Больше записей можно найти через поиск.</p>
        <div class="chips">${chips.map(([id, label]) => `<button class="chip ${g === id ? 'active' : ''}" data-genre="${esc(id)}">${esc(label)}</button>`).join('')}</div>
        <div class="actions" style="margin-bottom:12px"><button class="btn primary" data-play="${k}">${ICON.play} Слушать подряд</button></div>
        <div class="list">${items.map((it, i) => row(it, k, i, { genre: g === 'all' })).join('')}</div>`;
    },

    bands() {
      return `<h1>Группы BM</h1>
        <p class="muted">Собственные артисты BM: русские группы с русскими песнями. Названия, тексты и песни © BM.</p>
        <div class="grid" style="margin-top:20px">${bands.map(bandCard).join('')}</div>
        <div class="section">${head('Все песни групп', '')}${list(bandSongs, { genre: false })}</div>`;
    },

    band(id) {
      const b = bands.find(x => x.id === id);
      if (!b) return notFound();
      const k = R(b.songs);
      const ready = b.songs.filter(s => !isMissing(s)).length;
      return `<button class="back" data-go="bands">${ICON.back} Группы BM</button>
        <div class="page-head">
          ${coverHTML(b.songs[0], 'big')}
          <div>
            <div class="hero-kicker">${esc(b.genre)} · ${esc(b.city)} · © BM</div>
            <h1>${esc(b.name)}</h1>
            <div class="muted">${b.members.map(esc).join(' · ')}</div>
            <p>${esc(b.bio)}</p>
            <div class="actions">${ready ? `<button class="btn primary" data-play="${k}">${ICON.play} Слушать</button>` : '<span class="badge bm soon">Песни скоро выйдут</span>'}</div>
          </div>
        </div>
        <div class="list">${b.songs.map((it, i) => row(it, k, i)).join('')}</div>
        <p class="copyright">© ${b.year} BM. Все права на песни и тексты группы «${esc(b.name)}» принадлежат BM.</p>`;
    },

    podcasts() {
      return `<h1>Подкасты</h1>
        <p class="muted">Настоящие подкасты NASA. Выпуски на английском языке, новые подгружаются автоматически.</p>
        <div class="section" style="margin-top:20px"><div class="grid">${shows.map(showCard).join('')}</div></div>
        <div class="section">${head('Свежие выпуски', '')}${list(latestEpisodes(15), { desc: true })}</div>`;
    },

    show(id) {
      const s = shows.find(x => x.id === id);
      if (!s) return notFound();
      const eps = s.episodes.slice(0, state.epLimit);
      const k = R(s.episodes);
      return `<button class="back" data-go="podcasts">${ICON.back} Подкасты</button>
        <div class="page-head">
          <div class="cover has-img big"><img src="${esc(s.image)}" alt=""></div>
          <div>
            <div class="hero-kicker">Подкаст NASA</div>
            <h1>${esc(s.titleRu)}</h1>
            <div class="muted">${esc(s.title)} · ${s.total} ${plural(s.total, 'выпуск', 'выпуска', 'выпусков')}</div>
            <p>${esc(s.descRu)}</p>
            <div class="actions"><button class="btn primary" data-play="${k}">${ICON.play} Слушать новый выпуск</button></div>
          </div>
        </div>
        <div class="list">${eps.map((it, i) => row(it, k, i, { desc: true })).join('')}</div>
        ${s.episodes.length > eps.length ? `<div class="more"><button class="btn" data-act="more-eps">Показать ещё</button></div>` : ''}`;
    },

    playlists() {
      return `<h1>Плейлисты</h1>
        <p class="muted">Собирайте любимую музыку и выпуски подкастов. Плейлисты хранятся в этом браузере.</p>
        <div class="grid" style="margin-top:20px">
          <div class="card new-card" data-act="new-playlist"><div class="card-cover"><div class="cover dashed"><span class="cover-glyph">+</span></div></div><div class="card-title">Новый плейлист</div><div class="card-sub">Создать</div></div>
          ${state.playlists.map(playlistCard).join('')}
        </div>
        ${state.playlists.length ? '' : '<div class="empty" style="margin-top:20px">Чтобы добавить трек в плейлист, нажмите на значок <b>≡+</b> рядом с треком или в плеере.</div>'}`;
    },

    playlist(id) {
      const p = state.playlists.find(x => x.id === id);
      if (!p) return notFound();
      const k = R(p.items);
      const total = p.items.reduce((s, it) => s + durationOf(it), 0);
      return `<button class="back" data-go="playlists">${ICON.back} Плейлисты</button>
        <div class="page-head">
          ${plCover(p, 'big')}
          <div>
            <div class="hero-kicker">Плейлист</div>
            <h1>${esc(p.name)}</h1>
            <div class="muted">${p.items.length} ${plural(p.items.length, 'трек', 'трека', 'треков')}${total ? ' · ' + fmt(total) : ''}</div>
            <div class="actions" style="margin-top:14px">
              ${p.items.length ? `<button class="btn primary" data-play="${k}">${ICON.play} Слушать</button>` : ''}
              <button class="btn" data-act="rename-pl">${ICON.edit} Переименовать</button>
              <button class="btn ghost danger" data-act="delete-pl">${ICON.trash} Удалить</button>
            </div>
          </div>
        </div>
        ${p.items.length ? `<div class="list">${p.items.map((it, i) => row(it, k, i, { unlist: true })).join('')}</div>`
          : '<div class="empty">Плейлист пуст. Найдите музыку через поиск или в разделе «Музыка» и нажмите <b>≡+</b>.</div>'}`;
    },

    search() {
      const q = state.query;
      const m = matcher(q);
      const music = allMusic().filter(it => m(hay(it)));
      const showsF = shows.filter(s => m(norm(s.title + ' ' + s.titleRu + ' ' + s.descRu)));
      const eps = allEpisodes().filter(it => m(hay(it))).slice(0, 40);
      const pls = state.playlists.filter(p => m(norm(p.name)));
      const bandsF = bands.filter(b => m(norm([b.name, b.genre, b.city, b.bio].join(' '))));
      const nothing = !music.length && !showsF.length && !eps.length && !pls.length && !bandsF.length;
      return `<h1>Поиск: «${esc(q)}»</h1>
        ${nothing ? '<div class="empty" style="margin-top:16px">В библиотеке BM ничего не нашлось. Смотрите результаты из Wikimedia Commons ниже.</div>' : ''}
        ${bandsF.length ? `<div class="section">${head('Группы BM', '')}<div class="grid">${bandsF.map(bandCard).join('')}</div></div>` : ''}
        ${pls.length ? `<div class="section">${head('Плейлисты', '')}<div class="grid">${pls.map(playlistCard).join('')}</div></div>` : ''}
        ${music.length ? `<div class="section">${head('Музыка', '')}${list(music.slice(0, 50), { genre: true })}</div>` : ''}
        ${showsF.length ? `<div class="section">${head('Подкасты', '')}<div class="grid">${showsF.map(showCard).join('')}</div></div>` : ''}
        ${eps.length ? `<div class="section">${head('Выпуски подкастов', '')}${list(eps, { desc: true })}</div>` : ''}
        <div class="section">
          ${head('Ещё записи из Wikimedia Commons', 'Только общественное достояние и CC0')}
          <div id="commons-results">${commonsCache.has(norm(q)) ? commonsHTML(commonsCache.get(norm(q))) : '<div class="empty">Ищем…</div>'}</div>
        </div>`;
    }
  };

  pages.premium = () => {
    const u = user(), active = isPremium();
    return `<div class="premium-hero">
        <div class="hero-kicker">BM Премиум · бесплатно</div>
        <h1>Вся музыка BM без ограничений</h1>
        <p>Подписка бесплатная. Нужен только аккаунт BOS.</p>
        <ul class="perks">
          <li>🎸 Все песни групп BM: «Полярный трамвай», «Ферма снов», «Гранитные чайки», «Лиловый октябрь»</li>
          <li>🎙 Все подкасты и новые выпуски</li>
          <li>📝 Тексты песен групп BM</li>
          <li>≡ Плейлисты с любой музыкой и подкастами</li>
        </ul>
        <div class="plan-price free-price">0 ₽ <span>навсегда</span></div>
        <div class="actions" style="margin-top:14px">
          ${active
            ? `<span class="sub-status">✓ Подписка подключена с ${fmtDay(u.sub.since)}</span>`
            : `<button class="btn primary big-btn" data-act="subscribe">${u ? 'Оформить бесплатно' : 'Войти через BOS и оформить бесплатно'}</button>`}
        </div>
      </div>`;
  };

  pages.account = () => {
    const u = user();
    if (!u) return `<h1>Аккаунт</h1>
      <p class="muted">В BM входят через аккаунт BOS. Войдите, чтобы оформить бесплатную подписку.</p>
      <div class="actions" style="margin-top:16px"><button class="btn primary" data-act="login">Войти через BOS</button><a class="btn" href="${BOS_URL}" target="_blank" rel="noopener">Открыть BOS</a></div>`;
    const active = isPremium();
    return `<div class="account-head">
        <div class="avatar big">${esc(initials(u.name))}</div>
        <div><h1>${esc(u.name)}</h1><div class="muted">${esc(bosLabel(u.id))} · аккаунт BOS · в BM с ${fmtDay(u.created)}</div></div>
      </div>
      <div class="section">${head('Подписка', '')}
        ${active ? `<div class="sub-card">
            <div><b>BM Премиум</b> — бесплатно</div>
            <div class="muted">Подключена с ${fmtDay(u.sub.since)} · песни групп BM и подкасты открыты</div>
            <div class="actions" style="margin-top:12px"><button class="btn ghost danger" data-act="unsubscribe">Отключить подписку</button></div>
          </div>`
        : `<div class="sub-card">
            <div><b>Нет подписки</b></div>
            <div class="muted">Песни групп BM и подкасты закрыты. Подписка бесплатная.</div>
            <div class="actions" style="margin-top:12px"><button class="btn primary" data-act="subscribe">Оформить бесплатно</button></div>
          </div>`}
      </div>
      <div class="section actions"><button class="btn" data-act="logout">Выйти из BM</button><a class="btn ghost" href="${BOS_URL}" target="_blank" rel="noopener">Открыть BOS</a></div>
      <p class="test-note">Вход выполнен через аккаунт BOS. Имя берётся из BOS.</p>`;
  };

  const notFound = () => '<div class="empty">Здесь ничего нет. <button class="btn ghost" data-go="home">На главную</button></div>';

  // ---------- Поиск ----------
  function hay(it) {
    return norm([it.title, it.artist, it.genre, it.desc, it.lang, it.lyrics, it.license === 'ai' ? 'ии ai нейросеть suno udio вокал' : '', it.license === 'bm' ? 'bm бм группа' : ''].join(' '));
  }
  function aliasesFor(t) {
    if (t.length < 3) return ALIAS[t] ? [ALIAS[t]] : [];
    return Object.keys(ALIAS).filter(k => k.startsWith(t)).map(k => ALIAS[k]);
  }
  function matcher(q) {
    const tokens = norm(q).split(/\s+/).filter(Boolean).map(t => [t, ...aliasesFor(t)]);
    return h => tokens.every(alts => alts.some(a => h.includes(a)));
  }
  const translate = q => norm(q).split(/\s+/).filter(Boolean).map(t => ALIAS[t] || (aliasesFor(t)[0] || t)).join(' ');

  const commonsCache = new Map();
  const BLOCK = /shortstory|самоуправлен|^hmv-|^vocalion-|nazi|reich|lecture|speech|interview|pronunciation|^[a-z]{2,3}-[^ ]+$/i;
  async function commonsSearch(q) {
    const params = new URLSearchParams({
      action: 'query', generator: 'search', gsrnamespace: '6', gsrsearch: 'filetype:audio ' + translate(q), gsrlimit: '50',
      prop: 'imageinfo|videoinfo', iiprop: 'extmetadata', iiextmetadatafilter: 'LicenseShortName|Artist',
      viprop: 'derivatives|url|size', format: 'json', formatversion: '2', origin: '*'
    });
    const r = await fetch('https://commons.wikimedia.org/w/api.php?' + params);
    const d = await r.json();
    const known = new Set(catalog.map(t => t.id));
    const pages = (d.query && d.query.pages) || [];
    pages.sort((a, b) => (a.index || 0) - (b.index || 0));
    return pages.map(p => {
      const meta = ((p.imageinfo || [])[0] || {}).extmetadata || {};
      const vi = (p.videoinfo || [])[0] || {};
      const lic = (meta.LicenseShortName || {}).value || '';
      const dur = vi.duration || 0;
      const id = 'c' + p.pageid;
      const title = p.title.slice(5).replace(/\.(ogg|oga|opus|flac|wav|mp3|webm)$/i, '').replace(/_/g, ' ').replace(/^PDP-CH - /, '');
      if (!/^(public domain|pd|cc0)/i.test(lic) || dur < 60 || dur > 1500 || !vi.url || known.has(id) || BLOCK.test(title)) return null;
      let artist = plainText((meta.Artist || {}).value || '', 80).split(/\n/)[0];
      if (!artist || artist.length > 60 || /^(user:|composer:)/i.test(artist)) artist = 'Неизвестный исполнитель';
      const ogg = (vi.derivatives || []).find(x => /vorbis/.test(x.type || '') && x.src !== vi.url);
      return fromCommons({
        id, title, artist, src: vi.url.split('?')[0], ogg: ogg ? ogg.src : null, duration: Math.round(dur),
        page: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(p.title.replace(/ /g, '_')),
        license: /^cc0/i.test(lic) ? 'CC0' : 'pd', genre: 'Wikimedia Commons'
      });
    }).filter(Boolean);
  }
  function commonsHTML(items) {
    return items.length ? list(items) : '<div class="empty">В Wikimedia Commons ничего свободного по этому запросу не нашлось.</div>';
  }

  // Запрос к Commons запускается после каждой отрисовки страницы поиска, если ответа ещё нет
  let searchTimer, commonsTimer;
  function scheduleCommons(q) {
    clearTimeout(commonsTimer);
    if (!q || commonsCache.has(norm(q))) return;
    commonsTimer = setTimeout(async () => {
      let items;
      try { items = await commonsSearch(q); } catch (err) { items = null; }
      if (items) commonsCache.set(norm(q), items);
      const box = $('#commons-results');
      if (state.query !== q || !box) return;
      box.innerHTML = items ? commonsHTML(items) : '<div class="empty">Не удалось связаться с Wikimedia Commons. Проверьте интернет.</div>';
      markCurrent();
    }, 350);
  }
  $('#search').addEventListener('input', e => {
    state.query = e.target.value.trim();
    clearTimeout(searchTimer);
    clearTimeout(commonsTimer);
    searchTimer = setTimeout(() => { render(); main.scrollTop = 0; }, 180);
  });

  // ---------- Навигация ----------
  function render() {
    reg = [];
    const page = state.query ? pages.search() : (pages[state.route] || pages.home)(state.param);
    view.innerHTML = page;
    document.querySelectorAll('#nav button').forEach(b => {
      const r = state.route === 'show' ? 'podcasts' : state.route === 'playlist' ? 'playlists' : state.route === 'band' ? 'bands' : state.route;
      b.classList.toggle('active', !state.query && b.dataset.route === r);
    });
    markCurrent();
    updateAccountUI();
    if (state.query) scheduleCommons(state.query);
  }

  function parseHash() {
    const [route, param] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    state.route = pages[route] && route !== 'search' ? route : 'home';
    state.param = param || null;
    state.epLimit = 50;
  }
  function go(route, param) {
    const h = '#/' + route + (param ? '/' + encodeURIComponent(param) : '');
    if (state.query) { state.query = ''; $('#search').value = ''; }
    if (location.hash === h) { render(); main.scrollTop = 0; } else location.hash = h;
  }
  window.addEventListener('hashchange', () => {
    parseHash();
    if (state.query) { state.query = ''; $('#search').value = ''; }
    render();
    main.scrollTop = 0;
  });
  $('#nav').addEventListener('click', e => { const b = e.target.closest('button[data-route]'); if (b) go(b.dataset.route); });

  view.addEventListener('click', e => {
    const t = e.target;
    const add = t.closest('[data-add]');
    if (add) { const [k, i] = add.dataset.add.split(':').map(Number); openPicker(reg[k][i]); return; }
    const unl = t.closest('[data-unlist]');
    if (unl) { unlist(+unl.dataset.unlist); return; }
    const pl = t.closest('[data-play]');
    if (pl) { playFrom(reg[+pl.dataset.play], 0); return; }
    const gen = t.closest('[data-genre]');
    if (gen) { state.genre = gen.dataset.genre; render(); return; }
    const gg = t.closest('[data-go]');
    if (gg) { if (gg.dataset.genreGo) state.genre = gg.dataset.genreGo; go(gg.dataset.go); return; }
    const act = t.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'new-playlist') newPlaylist();
      if (a === 'login') openAuth();
      if (a === 'logout') logout();
      if (a === 'subscribe') subscribe();
      if (a === 'unsubscribe') unsubscribe();
      if (a === 'rename-pl') renamePlaylist();
      if (a === 'delete-pl') deletePlaylist();
      if (a === 'more-eps') { state.epLimit += 50; const y = main.scrollTop; render(); main.scrollTop = y; }
      return;
    }
    const ly = t.closest('[data-lyrics]');
    if (ly) { const [k, i] = ly.dataset.lyrics.split(':').map(Number); showLyrics(reg[k][i]); return; }
    const bd = t.closest('[data-band]');
    if (bd) { go('band', bd.dataset.band); return; }
    const sh = t.closest('[data-show]');
    if (sh) { go('show', sh.dataset.show); return; }
    const p = t.closest('[data-pl]');
    if (p) { go('playlist', p.dataset.pl); return; }
    const el = t.closest('[data-list]');
    if (el) playFrom(reg[+el.dataset.list], +el.dataset.i);
  });

  // ---------- Текст песни ----------
  const SECTION_RU = { 'Intro': 'Вступление', 'Verse 1': 'Куплет 1', 'Verse 2': 'Куплет 2', 'Verse 3': 'Куплет 3', 'Pre-Chorus': 'Перед припевом', 'Chorus': 'Припев', 'Bridge': 'Бридж', 'Outro': 'Концовка' };
  function lyricsHTML(text) {
    const blocks = [];
    let cur = null;
    text.split('\n').forEach(line => {
      const h = line.match(/^\[(.+)\]\s*$/);
      if (h) { cur = { name: h[1], lines: [] }; blocks.push(cur); return; }
      if (cur && line.trim()) cur.lines.push(line);
    });
    const seen = {};
    return blocks.map(b => {
      const repeat = !b.lines.length && seen[b.name];
      if (b.lines.length) seen[b.name] = b.lines;
      const lines = repeat ? seen[b.name] : b.lines;
      return `<div class="ly-block${repeat ? ' repeat' : ''}"><div class="ly-tag">${esc(SECTION_RU[b.name] || b.name)}</div>${lines.map(l => `<div>${esc(l)}</div>`).join('')}</div>`;
    }).join('');
  }
  let lyricsItem = null;
  function showLyrics(it) {
    if (!it || !it.lyrics) return;
    if (isLocked(it)) { openPaywall(it); return; }
    lyricsItem = it;
    const b = bands.find(x => x.id === it.band);
    $('#ly-title').textContent = it.title;
    $('#ly-band').textContent = (b ? `${b.name} · ${b.genre}` : it.artist) + (isMissing(it) ? ' · песня скоро выйдет' : '');
    $('#ly-text').innerHTML = lyricsHTML(it.lyrics);
    $('#ly-copy').textContent = `© ${b ? b.year : new Date().getFullYear()} BM. Текст песни принадлежит BM.`;
    $('#ly-play').hidden = isMissing(it);
    $('#lyrics-modal').hidden = false;
    $('#ly-text').scrollTop = 0;
  }
  $('#ly-play').addEventListener('click', () => {
    $('#lyrics-modal').hidden = true;
    if (lyricsItem && !(state.item && state.item.id === lyricsItem.id)) {
      const b = bands.find(x => x.id === lyricsItem.band);
      const q = b ? b.songs : [lyricsItem];
      playFrom(q, Math.max(0, q.findIndex(x => x.id === lyricsItem.id)));
    }
  });
  $('#b-lyrics').addEventListener('click', () => state.item && showLyrics(state.item));

  // ---------- Модальные окна ----------
  document.querySelectorAll('.modal-back').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.hidden = true; });
  });

  function askName(heading, initial = '') {
    return new Promise(res => {
      const m = $('#name-modal'), form = $('#name-form'), input = $('#name-input');
      $('#name-heading').textContent = heading;
      input.value = initial;
      m.hidden = false;
      setTimeout(() => { input.focus(); input.select(); }, 30);
      const done = v => { form.onsubmit = null; obs.disconnect(); m.hidden = true; res(v); };
      form.onsubmit = e => { e.preventDefault(); const v = input.value.trim(); if (v) done(v); };
      const obs = new MutationObserver(() => { if (m.hidden) done(null); });
      obs.observe(m, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  // ---------- Плейлисты ----------
  function createPlaylist(name, items = []) {
    const p = { id: uid('pl-'), name, items: items.map(snap), created: Date.now() };
    state.playlists.unshift(p);
    savePlaylists();
    return p;
  }
  async function newPlaylist() {
    const name = await askName('Новый плейлист', 'Мой плейлист ' + (state.playlists.length + 1));
    if (!name) return;
    const p = createPlaylist(name);
    toast(`Плейлист «${name}» создан`);
    go('playlist', p.id);
  }
  const currentPlaylist = () => state.route === 'playlist' && state.playlists.find(x => x.id === state.param);
  async function renamePlaylist() {
    const p = currentPlaylist();
    if (!p) return;
    const name = await askName('Переименовать плейлист', p.name);
    if (!name) return;
    p.name = name;
    savePlaylists();
    render();
  }
  function deletePlaylist() {
    const p = currentPlaylist();
    if (!p || !confirm(`Удалить плейлист «${p.name}»? Сами треки останутся в BM.`)) return;
    state.playlists = state.playlists.filter(x => x !== p);
    savePlaylists();
    toast('Плейлист удалён');
    go('playlists');
  }
  function unlist(i) {
    const p = currentPlaylist();
    if (!p) return;
    p.items.splice(i, 1);
    savePlaylists();
    render();
  }

  let pickItem = null;
  function openPicker(item) {
    pickItem = item;
    $('#pick-item').textContent = `«${item.title}» — ${item.artist}`;
    $('#pick-name').value = '';
    $('#pick-list').innerHTML = state.playlists.length
      ? state.playlists.map(p => {
          const has = p.items.some(x => x.id === item.id);
          return `<button class="pick ${has ? 'has' : ''}" data-pick="${esc(p.id)}"><span>${esc(p.name)}</span><span class="muted">${has ? '✓ уже есть' : p.items.length + ' ' + plural(p.items.length, 'трек', 'трека', 'треков')}</span></button>`;
        }).join('')
      : '<div class="muted">Плейлистов пока нет. Создайте первый:</div>';
    $('#pick-modal').hidden = false;
  }
  $('#pick-list').addEventListener('click', e => {
    const b = e.target.closest('[data-pick]');
    if (!b || !pickItem) return;
    const p = state.playlists.find(x => x.id === b.dataset.pick);
    if (!p) return;
    if (p.items.some(x => x.id === pickItem.id)) { toast('Этот трек уже есть в плейлисте'); return; }
    p.items.push(snap(pickItem));
    savePlaylists();
    $('#pick-modal').hidden = true;
    toast(`Добавлено в «${p.name}»`);
    if (state.route === 'playlist' || state.route === 'playlists' || state.route === 'home') render();
  });
  $('#pick-new').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#pick-name').value.trim();
    if (!name || !pickItem) return;
    createPlaylist(name, [pickItem]);
    $('#pick-modal').hidden = true;
    toast(`Плейлист «${name}» создан`);
    if (!state.query && ['playlists', 'home'].includes(state.route)) render();
  });

  // ---------- Свежие выпуски подкастов прямо из RSS (без сервера) ----------
  const ITUNES = 'http://www.itunes.com/dtds/podcast-1.0.dtd';
  function parseDur(s) {
    if (!s) return 0;
    return s.trim().split(':').reduce((acc, x) => acc * 60 + (parseFloat(x) || 0), 0);
  }
  async function refreshFeeds() {
    let changed = false;
    await Promise.all(shows.map(async s => {
      try {
        const r = await fetch(s.feed);
        if (!r.ok) return;
        const x = new DOMParser().parseFromString(await r.text(), 'application/xml');
        const eps = [...x.getElementsByTagName('item')].map(it => {
          const enc = it.getElementsByTagName('enclosure')[0];
          const url = enc && enc.getAttribute('url');
          if (!url) return null;
          const get = tag => (it.getElementsByTagName(tag)[0] || {}).textContent || '';
          const d = it.getElementsByTagNameNS(ITUNES, 'duration')[0];
          return episodeItem(s, {
            title: plainText(get('title'), 160), date: get('pubDate'), src: url,
            duration: Math.round(parseDur(d && d.textContent)), desc: plainText(get('description'))
          });
        }).filter(Boolean);
        if (eps.length && (eps.length !== s.episodes.length || eps[0].id !== s.episodes[0].id)) {
          s.episodes = eps;
          s.total = eps.length;
          changed = true;
        }
      } catch (e) { /* без интернета остаётся встроенный снимок */ }
    }));
    if (changed && !state.query && ['home', 'podcasts', 'show'].includes(state.route) && !anyModalOpen()) {
      const y = main.scrollTop;
      render();
      main.scrollTop = y;
    }
  }

  // ---------- Аккаунт BM и бесплатная подписка (всё хранится в браузере) ----------
  // ---------- Вход через аккаунт BOS ----------
  // BOS (vier4.github.io/BOS/) хранит аккаунт в памяти браузера своего сайта.
  // BM, открытый на том же сайте (vier4.github.io/BM/), читает его напрямую — сервер не нужен.
  const BOS_URL = 'https://vier4.github.io/BOS/';
  const readJSON = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  function bosAccount() {
    const s = readJSON('bos.state.v1');
    if (!s || !s.setupDone || s.guest || !s.id) return null;
    return { id: s.id, name: s.name || s.id, lock: s.lock || null };
  }
  const normalizeBosId = v => String(v || '').trim().toLowerCase().replace(/@bid$/, '');
  const bosLabel = id => id + '@bid';
  async function bosDigest(text) { // так же, как BOS проверяет пароль: SHA-256 от «соль:пароль»
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const auth = { accounts: store.get('bm-bos-accounts', {}), id: store.get('bm-bos-session', null) };
  const saveAuth = () => { store.set('bm-bos-accounts', auth.accounts); store.set('bm-bos-session', auth.id); };
  function user() {
    if (!auth.id) return null;
    const b = bosAccount();
    if (!b || b.id !== auth.id) return null; // в BOS сменили аккаунт или удалили его — входить заново
    const u = auth.accounts[auth.id] || (auth.accounts[auth.id] = { id: auth.id, created: Date.now(), sub: null });
    u.name = b.name;
    return u;
  }
  function isPremium() {
    const u = user();
    return !!(u && u.sub && u.sub.active);
  }
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  const fmtDay = t => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  function updateAccountUI() {
    const u = user(), prem = isPremium();
    const acc = $('#top-account');
    acc.innerHTML = u ? `<span class="avatar">${esc(initials(u.name))}</span><span class="hide-sm">${esc(u.name.split(' ')[0])}</span>` : '<span>Войти<span class="hide-sm"> через BOS</span></span>';
    acc.classList.toggle('logged', !!u);
    const pb = $('#top-premium');
    pb.textContent = prem ? '✓ Премиум' : 'BM Премиум';
    pb.classList.toggle('active', prem);
  }

  // ---------- Меню входа через BOS ----------
  // Если на устройстве уже есть аккаунт BOS — входим в него (B ID + пароль BOS, как на экране блокировки BOS).
  // Если аккаунта нет — можно подключить свой B ID или создать новый прямо здесь,
  // в том же формате, в каком его создаёт мастер настройки BOS.
  const BID_RULE = /^[a-z0-9][a-z0-9._]{2,19}$/; // то же правило, что в BOS
  const onBosSite = () => location.hostname === 'vier4.github.io';
  const knownBids = () => readJSON('bos.ids.v1') || {};
  function writeBosAccount(id, name, lock) {
    const prev = readJSON('bos.state.v1') || {};
    const next = Object.assign({}, prev, { setupDone: true, guest: false, id, name, lock: lock || null, lang: prev.lang || 'ru' });
    localStorage.setItem('bos.state.v1', JSON.stringify(next));
    const ids = knownBids();
    ids[id] = { name };
    localStorage.setItem('bos.ids.v1', JSON.stringify(ids));
  }
  const randomHex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');

  let afterAuth = null;
  function openAuth(then) {
    afterAuth = then || null;
    $('#auth-form').reset();
    setAuthMode(bosAccount() ? 'login' : 'create');
    $('#auth-offsite').hidden = onBosSite();
    $('#auth-modal').hidden = false;
  }
  function setAuthMode(mode) {
    const b = bosAccount();
    const m = $('#auth-modal');
    m.dataset.mode = mode;
    document.querySelectorAll('#auth-segs button').forEach(x => x.classList.toggle('active', x.dataset.mode === mode));
    $('#auth-login').hidden = mode !== 'login';
    $('#auth-create').hidden = mode !== 'create';
    $('#auth-error').textContent = '';
    if (mode === 'login') {
      $('#auth-pass-wrap').hidden = !(b && b.lock);
      $('#auth-login-note').textContent = b ? '' : 'На этом устройстве ещё нет аккаунта BOS. Введите свой B ID, и он будет подключён к устройству.';
      $('#auth-submit').textContent = b ? 'Войти' : 'Подключить B ID';
      $('#auth-submit').hidden = false;
    } else {
      $('#auth-busy').hidden = !b;
      $('#auth-create-fields').hidden = !!b;
      if (b) $('#auth-busy-name').textContent = `${b.name} · ${bosLabel(b.id)}`;
      $('#auth-submit').textContent = 'Создать B ID';
      $('#auth-submit').hidden = !!b;
      checkNewId(false);
    }
    setTimeout(() => {
      const el = mode === 'login' ? $('#auth-id') : $('#auth-name');
      if (!el.closest('[hidden]')) el.focus();
    }, 30);
  }
  $('#auth-segs').addEventListener('click', e => { const x = e.target.closest('button[data-mode]'); if (x) setAuthMode(x.dataset.mode); });
  $('#auth-busy-login').addEventListener('click', () => setAuthMode('login'));

  // Живая подсказка под новым B ID — как в BOS
  function checkNewId(strict) {
    const id = normalizeBosId($('#auth-new-id').value);
    const st = $('#auth-new-status');
    const set = (text, kind) => { st.textContent = text; st.className = 'bos-note' + (kind ? ' ' + kind : ''); };
    if (!BID_RULE.test(id)) {
      set('От 3 до 20 символов: латинские буквы, цифры, точка или подчёркивание. Начинается с буквы или цифры.', strict || /[^a-z0-9._]/.test(id) ? 'err' : '');
      return false;
    }
    if (knownBids()[id]) { set('Этот B ID уже занят на этом устройстве', 'err'); return false; }
    set('Свободен', 'ok');
    return true;
  }
  $('#auth-new-id').addEventListener('input', () => checkNewId(false));

  function finishAuth(id, name, msg) {
    auth.id = id;
    user();
    saveAuth();
    $('#auth-modal').hidden = true;
    toast(msg);
    const then = afterAuth;
    afterAuth = null;
    render();
    if (then) then();
  }

  $('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const err = msg => { $('#auth-error').textContent = msg; };
    const b = bosAccount();
    try {
      if ($('#auth-modal').dataset.mode === 'login') {
        const id = normalizeBosId($('#auth-id').value);
        if (!id) return err('Введите B ID.');
        if (!b) { // аккаунта нет — подключаем B ID к устройству, как «У меня уже есть» в BOS
          if (!BID_RULE.test(id)) return err('Такого B ID быть не может: от 3 до 20 символов, латиница, цифры, точка или подчёркивание.');
          const name = (knownBids()[id] || {}).name || id;
          writeBosAccount(id, name, null);
          return finishAuth(id, name, `B ID ${bosLabel(id)} подключён. Добро пожаловать, ${name}!`);
        }
        if (id !== b.id) {
          return err(knownBids()[id]
            ? 'Этот B ID сейчас не включён на устройстве. Войдите в него в BOS и попробуйте снова.'
            : 'На этом устройстве другой аккаунт BOS. Введите его B ID.');
        }
        if (b.lock) {
          const pw = $('#auth-password').value;
          if (!pw) return err('Введите пароль BOS.');
          if (await bosDigest(`${b.lock.salt}:${pw}`) !== b.lock.hash) return err('Неверный пароль BOS.');
        }
        return finishAuth(id, b.name, `Вы вошли через BOS: ${b.name}`);
      }
      // Создание нового аккаунта BOS
      if (b) return err('На этом устройстве уже есть аккаунт BOS.');
      const name = $('#auth-name').value.trim();
      if (!name) { $('#auth-name').focus(); return err('Введите имя.'); }
      if (!checkNewId(true)) { $('#auth-new-id').focus(); return err(''); }
      const id = normalizeBosId($('#auth-new-id').value);
      const pw = $('#auth-new-pass').value, pw2 = $('#auth-new-pass2').value;
      if (pw !== pw2) return err('Пароли не совпадают.');
      let lock = null;
      if (pw) { const salt = randomHex(16); lock = { salt, hash: await bosDigest(`${salt}:${pw}`) }; }
      writeBosAccount(id, name, lock);
      finishAuth(id, name, `Аккаунт BOS ${bosLabel(id)} создан. Добро пожаловать, ${name}!`);
    } catch (ex) {
      err('Не получилось: браузер не даёт сохранить данные. Проверьте, что сайт открыт по https.');
    }
  });

  function logout() {
    if (state.item && isPremiumContent(state.item)) { stopCurrent(); state.item = null; updatePlayerInfo(); }
    auth.id = null;
    saveAuth();
    toast('Вы вышли из BM. Аккаунт BOS остался включён в BOS.');
    go('home');
  }

  // Подписка бесплатная: нужен только аккаунт BM
  function subscribe() {
    if (!user()) { openAuth(subscribe); return; }
    const u = user();
    if (isPremium()) { go('account'); return; }
    u.sub = { active: true, since: Date.now() };
    saveAuth();
    toast('Подписка BM Премиум подключена бесплатно! Песни групп BM и подкасты открыты.');
    go('account');
  }
  function unsubscribe() {
    const u = user();
    if (!u || !u.sub || !confirm('Отключить подписку BM Премиум? Песни групп BM и подкасты снова закроются.')) return;
    u.sub = null;
    saveAuth();
    if (state.item && isPremiumContent(state.item)) { stopCurrent(); state.item = null; updatePlayerInfo(); }
    toast('Подписка отключена. Подключить её снова можно в любой момент — бесплатно.');
    render();
  }

  // Окно «нужна подписка»
  function openPaywall(item) {
    const band = item && item.kind === 'band';
    $('#pw-title').textContent = band ? 'Песни групп BM — в BM Премиум' : 'Подкасты — в BM Премиум';
    $('#pw-text').textContent = band
      ? `«${item.title}» и все песни групп BM доступны по бесплатной подписке. Нужен только аккаунт BOS.`
      : 'Все подкасты и новые выпуски доступны по бесплатной подписке. Нужен только аккаунт BOS.';
    $('#pw-login').hidden = !!user();
    $('#paywall-modal').hidden = false;
  }
  $('#pw-subscribe').addEventListener('click', () => { $('#paywall-modal').hidden = true; subscribe(); });
  $('#pw-login').addEventListener('click', () => { $('#paywall-modal').hidden = true; openAuth(); });
  $('#top-account').addEventListener('click', () => { if (user()) go('account'); else openAuth(); });
  $('#top-premium').addEventListener('click', () => go('premium'));

  // ---------- Старт ----------
  if (auth.id && !user()) { auth.id = null; saveAuth(); }
  (async () => {
    parseHash();
    render();
    await DB.open();
    let has = !!(await DB.get('user-song'));
    if (!has) { try { has = (await fetch(L.userSong.src, { method: 'HEAD' })).ok; } catch (e) { has = false; } }
    state.userSongSaved = has;
    await Promise.all(bandSongs.map(async it => {
      try { songStatus[it.id] = (await fetch(it.src, { method: 'HEAD' })).ok ? 'ready' : 'missing'; }
      catch (e) { songStatus[it.id] = 'unknown'; } // открыто как файл — проверим при воспроизведении
    }));
    render();
    refreshFeeds();
  })();
})();
