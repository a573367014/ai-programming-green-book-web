/* Offline Green Book reader. No requests, frameworks or remote dependencies. */
(() => {
  'use strict';
  const book = window.GREEN_BOOK;
  if (!book) return;
  const root = document.body.dataset.root || '';
  const currentId = document.body.dataset.lesson;
  const current = book.lessons.find(x => x.id === currentId);
  const $ = (s, scope = document) => scope.querySelector(s);
  const $$ = (s, scope = document) => [...scope.querySelectorAll(s)];
  const escape = s => String(s).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const normalize = s => s.normalize('NFKC').toLowerCase();
  const chevron = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
  const check = '<svg class="read-indicator" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  const labels = {article: '图文', exercise: '练习', video: '视频'};
  const readStore = (name, fallback) => {
    try { return JSON.parse(localStorage.getItem('greenbook.' + name)) || fallback; }
    catch (_) { return fallback; }
  };
  const writeStore = (name, value) => {
    try { localStorage.setItem('greenbook.' + name, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  };
  let state = readStore('state', {read: [], saved: [], positions: {}, last: null});
  state = {read: [], saved: [], positions: {}, last: null, ...state};
  if (!Array.isArray(state.read)) state.read = [];
  if (!Array.isArray(state.saved)) state.saved = [];
  if (!state.positions || typeof state.positions !== 'object') state.positions = {};
  let preferences = {theme: 'light', size: 18, focus: false, ...readStore('preferences', {})};
  let toastTimer;
  const toast = message => {
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2200);
  };

  function renderNav() {
    $('#chapter-nav').innerHTML = book.stages.map(stage => {
      const lessons = book.lessons.filter(x => x.stage === stage.id);
      const active = current ? current.stage === stage.id : stage.id === 1;
      const weeks = [...new Set(lessons.map(x => x.week))];
      return `<details class="nav-stage" ${active ? 'open' : ''}><summary><span class="nav-stage-number">${String(stage.id).padStart(2, '0')}</span><span>${escape(stage.title)}</span>${chevron}</summary><div class="nav-stage-body">${weeks.map(week => {
        const group = lessons.filter(x => x.week === week);
        const weekActive = current ? current.week === week : week === 1;
        const modules = [...new Set(group.map(x => x.module))];
        return `<details class="nav-week" ${weekActive ? 'open' : ''}><summary><span class="nav-week-label">第 ${week} 周</span><span class="nav-week-title">${escape(group[0].week_title)}</span>${chevron}</summary>${modules.map(module => {
          const selected = current && current.week === week && current.module === module;
          return `<details class="nav-module" ${selected ? 'open' : ''}><summary><span>${escape(module)}</span>${chevron}</summary><div class="nav-lessons">${group.filter(x => x.module === module).map(x => `<a class="nav-lesson ${x.id === currentId ? 'active' : ''}" href="${root}lessons/${x.id}.html" data-nav-id="${x.id}" ${x.id === currentId ? 'aria-current="page"' : ''}><span>${escape(x.title)}</span>${state.read.includes(x.id) ? check : ''}</a>`).join('')}</div></details>`;
        }).join('')}</details>`;
      }).join('')}</div></details>`;
    }).join('');
    if (current) {
      requestAnimationFrame(() => {
        const activeLink = $('.nav-lesson.active');
        if (!activeLink) return;
        const nav = $('#chapter-nav');
        const bounds = activeLink.getBoundingClientRect();
        const navBounds = nav.getBoundingClientRect();
        if (bounds.bottom > navBounds.bottom || bounds.top < navBounds.top) nav.scrollTop += bounds.top - navBounds.top - 100;
      });
    }
  }

  function updateStudy() {
    const read = state.read.filter(id => book.lessons.some(x => x.id === id));
    $('#read-count').textContent = `${read.length} / ${book.lessons.length}`;
    $('#study-progress').style.width = `${read.length / book.lessons.length * 100}%`;
    if (current) {
      const isRead = state.read.includes(current.id);
      $('#mark-read').setAttribute('aria-pressed', String(isRead));
      $('#mark-read span').textContent = isRead ? '已读 · 点击撤销' : '标记为已读';
      const isSaved = state.saved.includes(current.id);
      $('#bookmark-button').setAttribute('aria-pressed', String(isSaved));
      $('#bookmark-button span').textContent = isSaved ? '已收藏' : '收藏';
    }
  }

  function applyPreferences() {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.setProperty('--reading-size', preferences.size + 'px');
    const dark = preferences.theme === 'dark';
    const themeButton = $('.theme-button');
    themeButton.setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
    themeButton.title = dark ? '切换浅色模式' : '切换深色模式';
    themeButton.innerHTML = dark ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></svg>' : '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/></svg>';
    if (current) {
      $('#font-size').value = preferences.size;
      $('#font-size-value').value = preferences.size + ' px';
      $('#focus-mode').checked = preferences.focus;
      document.body.classList.toggle('focus-mode', preferences.focus);
    }
  }
  $('.theme-button').addEventListener('click', () => {
    preferences.theme = preferences.theme === 'dark' ? 'light' : 'dark';
    writeStore('preferences', preferences);
    applyPreferences();
  });

  function setNav(open) {
    if (open && preferences.focus && current) {
      preferences.focus = false;
      writeStore('preferences', preferences);
      applyPreferences();
    }
    document.body.classList.toggle('nav-open', open);
    $('.sidebar-backdrop').hidden = !open;
    $('.mobile-menu').setAttribute('aria-expanded', String(open));
    if (open) $('.sidebar-close').focus();
  }
  $('.mobile-menu').addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
  $('.sidebar-close').addEventListener('click', () => setNav(false));
  $('.sidebar-backdrop').addEventListener('click', () => setNav(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.body.classList.contains('nav-open')) setNav(false);
  });
  $('#chapter-nav').addEventListener('click', event => {
    if (event.target.closest('a')) setNav(false);
  });

  // Load a local script instead of fetch: search also works on file:// pages.
  const searchDialog = $('#search-dialog');
  const searchInput = $('#search-input');
  let indexPromise, searchFilter = 'all', searchTicket = 0, searchTimer;
  function loadIndex() {
    if (window.GREEN_BOOK_SEARCH) return Promise.resolve(window.GREEN_BOOK_SEARCH);
    if (!indexPromise) indexPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = root + 'assets/search-index.js';
      script.onload = () => resolve(window.GREEN_BOOK_SEARCH);
      script.onerror = () => { indexPromise = null; script.remove(); reject(new Error('index unavailable')); };
      document.head.appendChild(script);
    });
    return indexPromise;
  }
  function highlight(text, terms) {
    if (!terms.length) return escape(text);
    const pattern = terms.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(pattern, 'gi');
    let result = '', end = 0;
    for (const match of text.matchAll(regex)) {
      result += escape(text.slice(end, match.index)) + '<mark>' + escape(match[0]) + '</mark>';
      end = match.index + match[0].length;
    }
    return result + escape(text.slice(end));
  }
  function snippet(text, terms) {
    text = text.replace(/\s+/g, ' ').trim();
    const lower = normalize(text);
    const positions = terms.map(t => lower.indexOf(t)).filter(i => i >= 0);
    const pos = positions.length ? Math.min(...positions) : 0;
    const start = Math.max(0, pos - 45);
    const end = Math.min(text.length, start + 180);
    return (start ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }
  function allowed(item) {
    return searchFilter === 'all' || (searchFilter === 'saved' ? state.saved.includes(item.id) : item.type === searchFilter);
  }
  function resultHtml(item, text = '', anchor = '', terms = []) {
    return `<a class="search-result" href="${root}lessons/${item.id}.html${anchor ? '#' + anchor : ''}"><strong>${highlight(item.title, terms)}<span class="type-badge ${item.type}">${labels[item.type]}</span></strong><small>阶段 ${item.stage} · 第 ${item.week} 周 · ${escape(item.module)}</small>${text ? '<p>' + highlight(snippet(text, terms), terms) + '</p>' : ''}</a>`;
  }
  async function runSearch() {
    const ticket = ++searchTicket;
    const query = normalize(searchInput.value.trim());
    const terms = [...new Set(query.split(/\s+/).filter(Boolean))].slice(0, 10);
    if (!terms.length) {
      const items = book.lessons.filter(allowed);
      if (searchFilter !== 'all') {
        $('#search-status').textContent = searchFilter === 'saved' ? `${items.length} 个收藏课节` : `${items.length} 个${labels[searchFilter]}课节`;
        $('#search-results').innerHTML = items.length ? items.map(x => resultHtml(x)).join('') : '<p class="search-empty">暂无收藏。阅读时点击「收藏」即可在这里找回。</p>';
      } else {
        $('#search-status').textContent = '输入关键词，搜索整本教程';
        $('#search-results').innerHTML = `<div class="search-suggestions"><p>试着搜索一个概念</p>${['RAG','MCP','Agent','Embedding','Prompt'].map(x => `<button data-query="${x}">${x}</button>`).join('')}</div>${['lesson-005','lesson-094','lesson-112'].map(id => book.lessons.find(x => x.id === id)).filter(Boolean).map(x => resultHtml(x)).join('')}`;
      }
      return;
    }
    $('#search-status').textContent = '正在搜索完整教程…';
    let index;
    try { index = await loadIndex(); }
    catch (_) {
      if (ticket !== searchTicket) return;
      $('#search-status').textContent = '搜索索引无法打开';
      $('#search-results').innerHTML = '<p class="search-empty">请保持 assets 文件夹与网页在同一项目中，再重新搜索。</p>';
      return;
    }
    if (ticket !== searchTicket) return;
    const matches = [];
    for (const item of index) {
      if (!allowed(item)) continue;
      const title = normalize(item.title);
      const context = normalize(item.module + ' ' + item.title);
      const full = context + '\n' + item.sections.map(s => normalize(s.text)).join('\n');
      if (!terms.every(t => full.includes(t))) continue;
      let best = null, bestScore = -1;
      for (const section of item.sections) {
        const t = normalize(section.text);
        const score = terms.reduce((n, q) => n + (t.includes(q) ? 10 : 0), 0);
        if (score > bestScore) { bestScore = score; best = section; }
      }
      const score = terms.reduce((n, q) => n + (title.includes(q) ? 80 : context.includes(q) ? 25 : 0), 0) + bestScore;
      matches.push({item, score, best});
    }
    matches.sort((a, b) => b.score - a.score);
    $('#search-status').textContent = matches.length ? `找到 ${matches.length} 个相关课节${matches.length > 70 ? '，显示前 70 个' : ''}` : '没有找到相关内容';
    $('#search-results').innerHTML = matches.length ? matches.slice(0, 70).map(x => resultHtml(x.item, x.best?.text || '', x.best?.anchor || '', terms)).join('') : '<p class="search-empty">试试更短的关键词，或切换到「全部」。</p>';
    $('#search-results').scrollTop = 0;
  }
  function openSearch() {
    if (searchDialog.open) { searchInput.focus(); return; }
    setNav(false);
    searchDialog.showModal();
    runSearch();
    searchInput.focus();
  }
  $$('.search-trigger').forEach(button => button.addEventListener('click', openSearch));
  searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 120); });
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); $('.search-result')?.focus(); }
  });
  $('.search-top').addEventListener('submit', event => {
    if (event.submitter && event.submitter.matches('button')) return;
    event.preventDefault();
    $('.search-result')?.click();
  });
  $$('.search-filters button').forEach(button => button.addEventListener('click', () => {
    searchFilter = button.dataset.filter;
    $$('.search-filters button').forEach(b => b.classList.toggle('selected', b === button));
    runSearch();
  }));
  $('#search-results').addEventListener('click', event => {
    const suggestion = event.target.closest('[data-query]');
    if (suggestion) { searchInput.value = suggestion.dataset.query; runSearch(); searchInput.focus(); }
  });
  searchDialog.addEventListener('click', event => {
    if (event.target !== searchDialog) return;
    const rect = searchDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) searchDialog.close();
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
  });

  if (!current) {
    const last = book.lessons.find(x => x.id === state.last);
    if (last) {
      const link = $('#continue-link');
      link.href = `lessons/${last.id}.html`;
      link.textContent = `继续上次阅读：${last.title} →`;
      link.hidden = false;
    }
    let catalogFilter = 'all';
    function filterCatalog() {
      $$('.catalog-lesson').forEach(row => {
        row.hidden = catalogFilter === 'saved' ? !state.saved.includes(row.dataset.lessonId) : catalogFilter !== 'all' && row.dataset.type !== catalogFilter;
      });
      $$('.catalog-module').forEach(group => { group.hidden = !$$('.catalog-lesson', group).some(x => !x.hidden); });
      $$('.catalog-week').forEach(group => {
        group.hidden = !$$('.catalog-module', group).some(x => !x.hidden);
        if (catalogFilter !== 'all' && !group.hidden) group.open = true;
      });
      $$('.catalog-stage').forEach(group => { group.hidden = !$$('.catalog-week', group).some(x => !x.hidden); });
      $('#catalog-empty').hidden = $$('.catalog-lesson').some(x => !x.hidden);
      $('#catalog-empty').textContent = catalogFilter === 'saved' ? '这里还没有收藏。阅读时点击「收藏」，即可在这里找回课节。' : '当前分类没有内容。';
    }
    $$('[data-catalog-filter]').forEach(button => button.addEventListener('click', () => {
      catalogFilter = button.dataset.catalogFilter;
      $$('[data-catalog-filter]').forEach(b => b.classList.toggle('selected', b === button));
      filterCatalog();
    }));
    $('#expand-catalog').addEventListener('click', event => {
      const visible = $$('.catalog-week').filter(x => !x.hidden);
      const expand = !visible.every(x => x.open);
      visible.forEach(x => { x.open = expand; });
      event.currentTarget.textContent = expand ? '收起全部' : '展开全部';
    });
    function revealHash() {
      const hash = decodeURIComponent(location.hash.slice(1));
      const target = document.getElementById(hash);
      if (!target) return;
      if (target.classList.contains('catalog-stage')) {
        if (catalogFilter !== 'all') {
          catalogFilter = 'all';
          $$('[data-catalog-filter]').forEach(b => b.classList.toggle('selected', b.dataset.catalogFilter === 'all'));
          filterCatalog();
        }
        $('.catalog-week', target).open = true;
      }
      if (target.classList.contains('catalog-week')) target.open = true;
      requestAnimationFrame(() => target.scrollIntoView({block: 'start'}));
    }
    window.addEventListener('hashchange', revealHash);
    if (location.hash) revealHash();
  }

  if (current) {
    const initialPosition = Number(state.positions[current.id] || 0);
    state.last = current.id;
    writeStore('state', state);
    $('#bookmark-button').addEventListener('click', () => {
      const had = state.saved.includes(current.id);
      state.saved = had ? state.saved.filter(x => x !== current.id) : [...state.saved, current.id];
      const stored = writeStore('state', state);
      updateStudy();
      toast(stored ? had ? '已取消收藏' : '已收藏本节' : '本次已收藏，浏览器暂时无法保存');
    });
    $('#mark-read').addEventListener('click', () => {
      const had = state.read.includes(current.id);
      state.read = had ? state.read.filter(x => x !== current.id) : [...state.read, current.id];
      writeStore('state', state);
      updateStudy();
      const navLink = $(`[data-nav-id="${current.id}"]`);
      $('.read-indicator', navLink)?.remove();
      if (!had) navLink.insertAdjacentHTML('beforeend', check);
      toast(had ? '已撤销已读标记' : '已记录本节阅读完成');
    });
    $('#reading-settings-button').addEventListener('click', () => {
      const settings = $('#reading-settings');
      settings.hidden = !settings.hidden;
      $('#reading-settings-button').setAttribute('aria-expanded', String(!settings.hidden));
    });
    $('#font-size').addEventListener('input', event => {
      preferences.size = Number(event.target.value);
      writeStore('preferences', preferences);
      applyPreferences();
    });
    $('#focus-mode').addEventListener('change', event => {
      preferences.focus = event.target.checked;
      writeStore('preferences', preferences);
      applyPreferences();
    });
    $('.print-button').addEventListener('click', () => window.print());
    if (initialPosition > 150 && !location.hash) {
      const resume = $('#resume-reading');
      resume.hidden = false;
      $('button', resume).addEventListener('click', () => {
        window.scrollTo({top: initialPosition, behavior: 'smooth'});
        resume.hidden = true;
      });
    }
    // Answers and explanations present in the original may be revealed on demand.
    $$('.answer-text').forEach(answer => {
      if (answer.parentElement.classList.contains('answer-toggle')) return;
      const details = document.createElement('details');
      details.className = 'answer-toggle';
      const summary = document.createElement('summary');
      summary.textContent = '查看原文答案与解析';
      details.appendChild(summary);
      answer.before(details);
      let next = answer;
      while (next && next.classList.contains('answer-text')) {
        const following = next.nextElementSibling;
        details.appendChild(next);
        next = following;
      }
    });
    if (window.Prism) window.Prism.highlightAllUnder($('#article-start'));
    $$('.copy-code').forEach(button => button.addEventListener('click', async () => {
      const text = $('code', button.closest('.code-block')).textContent;
      let copied = false;
      try { await navigator.clipboard.writeText(text); copied = true; }
      catch (_) {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0';
        document.body.appendChild(area);
        area.select();
        copied = document.execCommand('copy');
        area.remove();
        button.focus();
      }
      if (copied) {
        $('span', button).textContent = '已复制';
        toast('代码已复制');
        setTimeout(() => { $('span', button).textContent = '复制'; }, 1700);
      } else toast('请选中代码并复制');
    }));
    $$('.wrap-code').forEach(button => button.addEventListener('click', () => {
      const wrapped = button.closest('.code-block').classList.toggle('wrapped');
      button.textContent = wrapped ? '取消换行' : '换行';
      button.setAttribute('aria-pressed', String(wrapped));
    }));
    const imageDialog = $('#image-dialog');
    $$('.figure-open').forEach(button => button.addEventListener('click', () => {
      const source = $('img', button);
      $('img', imageDialog).src = source.src;
      $('img', imageDialog).alt = source.alt;
      imageDialog.showModal();
    }));
    imageDialog.addEventListener('click', event => { if (event.target === imageDialog) imageDialog.close(); });

    let scrollPending = false, saveTimer;
    const tocLinks = $$('.page-toc nav a');
    const headings = $$('h2[id],h3[id]', $('#article-start'));
    function updateProgress(save = false) {
      const article = $('#article-start');
      const top = article.getBoundingClientRect().top + window.scrollY - 110;
      const bottom = article.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 80;
      const percent = bottom <= top ? window.scrollY > top ? 100 : 0 : Math.max(0, Math.min(100, (window.scrollY - top) / (bottom - top) * 100));
      $('#reading-progress').style.width = percent + '%';
      $('#percent-read').textContent = Math.round(percent) + '%';
      let activeHeading = headings[0];
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= 165) activeHeading = heading;
        else break;
      }
      tocLinks.forEach(link => link.classList.toggle('current', !!activeHeading && link.hash === '#' + activeHeading.id));
      if (save && window.scrollY > 100) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          state.positions[current.id] = Math.round(window.scrollY);
          writeStore('state', state);
        }, 250);
      }
    }
    window.addEventListener('scroll', () => {
      if (scrollPending) return;
      scrollPending = true;
      requestAnimationFrame(() => { updateProgress(true); scrollPending = false; });
    }, {passive: true});
    window.addEventListener('resize', () => updateProgress());
    updateProgress();
  }
  const backTop = $('.back-top');
  window.addEventListener('scroll', () => { backTop.hidden = window.scrollY < 500; }, {passive: true});
  backTop.addEventListener('click', () => window.scrollTo({top: 0, behavior: 'smooth'}));
  window.addEventListener('storage', () => {
    state = {...state, ...readStore('state', state)};
    updateStudy();
  });
  renderNav();
  updateStudy();
  applyPreferences();
})();
