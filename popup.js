const STORAGE_KEY = 'commentkeep_saved';
let allComments = [];
let activeTag = null;
let searchQuery = '';

function loadData(cb) {
  chrome.storage.local.get(STORAGE_KEY, r => cb(r[STORAGE_KEY] || []));
}

function saveData(data, cb) {
  chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (tab && tab.url && tab.url.includes('youtube.com')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (key, d) => localStorage.setItem(key, JSON.stringify(d)),
          args: [STORAGE_KEY, data]
        });
      }
    });
    if (cb) cb();
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function highlight(text, query) {
  if (!query) return escHtml(text);
  const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escHtml(text).replace(new RegExp(esc, 'gi'), m => `<mark class="highlight">${m}</mark>`);
}

function formatTimestamp(seconds) {
  if (!seconds && seconds !== 0) return null;
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

function getFiltered() {
  return allComments.filter(c => {
    const matchTag = !activeTag || (c.tags || []).includes(activeTag);
    const q = searchQuery.toLowerCase();
    const matchSearch = !q
      || c.text.toLowerCase().includes(q)
      || (c.author || '').toLowerCase().includes(q)
      || (c.videoTitle || '').toLowerCase().includes(q)
      || (c.tags || []).some(t => t.toLowerCase().includes(q));
    return matchTag && matchSearch;
  });
}

function getAllTags() {
  const tags = new Set();
  allComments.forEach(c => (c.tags || []).forEach(t => tags.add(t)));
  return [...tags].sort();
}

function renderTagFilter() {
  const el = document.getElementById('tagFilter');
  const tags = getAllTags();
  el.innerHTML = '';
  tags.forEach(tag => {
    const pill = document.createElement('button');
    pill.className = 'tag-pill' + (activeTag === tag ? ' active' : '');
    pill.textContent = tag;
    pill.addEventListener('click', () => {
      activeTag = activeTag === tag ? null : tag;
      render();
    });
    el.appendChild(pill);
  });
}

function renderList() {
  const list = document.getElementById('commentList');
  const emptyState = document.getElementById('emptyState');
  const filtered = getFiltered();

  if (!filtered.length) {
    list.innerHTML = '';
    emptyState.classList.add('visible');
    return;
  }
  emptyState.classList.remove('visible');
  list.innerHTML = '';

  filtered.forEach(comment => {
    const card = document.createElement('div');
    card.className = 'comment-card';
    card.dataset.id = comment.id;

    // build timestamp URL
    const videoUrl = comment.videoTimestamp != null
      ? comment.videoUrl + (comment.videoUrl.includes('?') ? '&' : '?') + `t=${Math.floor(comment.videoTimestamp)}`
      : comment.videoUrl;

    const timestampHtml = comment.videoTimestamp != null
      ? `<div class="comment-card__timestamp">▶ ${formatTimestamp(comment.videoTimestamp)}</div>`
      : '';

    const tagsHtml = (comment.tags || []).map(t =>
      `<button class="comment-tag" type="button" data-tag="${escHtml(t)}" data-comment-id="${escHtml(comment.id)}">
         <span>${escHtml(t)}</span>
         <span class="comment-tag__remove" aria-label="Remove tag" data-remove-tag="${escHtml(t)}" data-comment-id="${escHtml(comment.id)}"></span>
       </button>`
    ).join('');

    const thumbHtml = comment.videoThumb
      ? `<img class="comment-card__thumb" src="${escHtml(comment.videoThumb)}" alt="" loading="lazy">`
      : `<div class="comment-card__thumb"></div>`;

    card.innerHTML = `
      <div class="comment-card__top">
        <span class="comment-card__author">${escHtml(comment.channelName || comment.author || 'Unknown')}</span>
        <div class="comment-card__actions">
          <button class="icon-btn" data-copy="${escHtml(comment.id)}" title="Copy" aria-label="Copy comment">
            <svg class="icon-btn__copy" width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2.69727 6.29932C2.69727 4.60247 2.69727 3.75345 3.22468 3.22663C3.7515 2.69922 4.60052 2.69922 6.29738 2.69922H8.09743C9.79429 2.69922 10.6433 2.69922 11.1701 3.22663C11.6975 3.75345 11.6975 4.60247 11.6975 6.29932V9.2994C11.6975 10.9963 11.6975 11.8453 11.1701 12.3721C10.6433 12.8995 9.79429 12.8995 8.09743 12.8995H6.29738C4.60052 12.8995 3.7515 12.8995 3.22468 12.3721C2.69727 11.8453 2.69727 10.9963 2.69727 9.2994V6.29932Z" stroke="#808080" stroke-width="1.2"/>
<path d="M2.39967 10.7999C1.92226 10.7999 1.46441 10.6102 1.12683 10.2727C0.789258 9.9351 0.599609 9.47725 0.599609 8.99984V5.39974C0.599609 3.13708 0.599609 2.00545 1.30283 1.30283C2.00605 0.600209 3.13709 0.599609 5.39976 0.599609H7.79983C8.27724 0.599609 8.73509 0.789257 9.07266 1.12683C9.41024 1.46441 9.59989 1.92226 9.59989 2.39966" stroke="#808080" stroke-width="1.2"/>
</svg>

            <svg class="icon-btn__done" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <button class="icon-btn danger" data-delete="${escHtml(comment.id)}" title="Delete" aria-label="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
      <p class="comment-card__text" data-expand="${escHtml(comment.id)}">${highlight(comment.text, searchQuery)}</p>
      <a class="comment-card__video" href="${escHtml(videoUrl)}" target="_blank" rel="noopener">
        ${thumbHtml}
        <div class="comment-card__video-info">
          <div class="comment-card__video-title">${escHtml(comment.videoTitle || 'Unknown video')}</div>
          ${timestampHtml}
        </div>
      </a>
      <div class="comment-card__tags" data-tagsrow="${escHtml(comment.id)}">
        <button class="comment-tag comment-tag--add" data-addtag="${escHtml(comment.id)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> tag</button>
        ${tagsHtml}
      </div>
      <div class="comment-card__tag-input-row" id="taginput-${escHtml(comment.id)}" style="display:none">
        <input type="text" class="comment-card__tag-input" placeholder="Add a tag" maxlength="24" data-taginputfor="${escHtml(comment.id)}">
        <button class="comment-card__tag-confirm" data-tagconfirm="${escHtml(comment.id)}" aria-label="Confirm tag">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </div>
    `;
    list.appendChild(card);
  });
}

function render() {
  document.getElementById('totalCount').textContent = `${allComments.length} Saved`;
  renderTagFilter();
  renderList();
}

// ── Event delegation ──
document.getElementById('commentList').addEventListener('click', e => {
  const copyBtn = e.target.closest('[data-copy]');
  const deleteBtn = e.target.closest('[data-delete]');
  const removeTagBtn = e.target.closest('[data-remove-tag]');
  const expandBtn = e.target.closest('[data-expand]');
  const addTagBtn = e.target.closest('[data-addtag]');
  const confirmBtn = e.target.closest('[data-tagconfirm]');
  const tagPill = e.target.closest('[data-tag]');

  if (copyBtn) {
    copyBtn.blur();
    const c = allComments.find(x => x.id === copyBtn.dataset.copy);
    if (c) navigator.clipboard.writeText(c.text).then(() => {
      copyBtn.classList.add('copied');
      setTimeout(() => copyBtn.classList.remove('copied'), 500);
    });
  }

  if (deleteBtn) {
    deleteBtn.blur();
    const updated = allComments.filter(x => x.id !== deleteBtn.dataset.delete);
    saveData(updated, () => { allComments = updated; render(); });
  }

  if (removeTagBtn) {
    removeTagBtn.blur();
    const commentId = removeTagBtn.dataset.commentId;
    const tag = removeTagBtn.dataset.removeTag;
    const c = allComments.find(x => x.id === commentId);
    if (c && c.tags) {
      c.tags = c.tags.filter(t => t !== tag);
      saveData(allComments, () => {
        // If the currently active tag was removed everywhere, clear the filter so list isn't empty
        if (activeTag && !getAllTags().includes(activeTag)) activeTag = null;
        render();
      });
    }
    return;
  }

  if (expandBtn) {
    // no-op — full comment always visible now
  }

  if (addTagBtn) {
    addTagBtn.blur();
    const id = addTagBtn.dataset.addtag;
    const row = document.getElementById(`taginput-${id}`);
    if (row) {
      const isVisible = row.style.display !== 'none';
      row.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) row.querySelector('input').focus();
    }
  }

  if (confirmBtn) {
    confirmBtn.blur();
    submitTag(confirmBtn.dataset.tagconfirm);
  }

  if (tagPill) {
    const t = tagPill.dataset.tag;
    activeTag = activeTag === t ? null : t;
    render();
  }
});

document.getElementById('commentList').addEventListener('keydown', e => {
  const input = e.target.closest('[data-taginputfor]');
  if (input && e.key === 'Enter') {
    submitTag(input.dataset.taginputfor);
  }
  if (input && e.key === 'Escape') {
    const row = document.getElementById(`taginput-${input.dataset.taginputfor}`);
    if (row) row.style.display = 'none';
  }
});

function submitTag(commentId) {
  const input = document.querySelector(`[data-taginputfor="${commentId}"]`);
  if (!input) return;
  const tag = input.value.trim().toLowerCase().replace(/\s+/g, '-');
  if (!tag) return;
  const c = allComments.find(x => x.id === commentId);
  if (c) {
    if (!(c.tags || []).includes(tag)) {
      c.tags = [...(c.tags || []), tag];
      saveData(allComments, () => render());
    } else {
      input.value = '';
    }
  }
}

// ── Search ──
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  clearSearch.style.display = searchQuery ? 'flex' : 'none';
  renderList();
});
clearSearch.addEventListener('click', () => {
  clearSearch.blur();
  searchInput.value = '';
  searchQuery = '';
  clearSearch.style.display = 'none';
  renderList();
});

// ── Close button (just closes the popup window) ──
document.getElementById('closeBtn').addEventListener('click', () => window.close());

// ── Init ──
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const tab = tabs[0];
  if (tab && tab.url && tab.url.includes('youtube.com')) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (key) => JSON.parse(localStorage.getItem(key) || '[]'),
      args: [STORAGE_KEY]
    }, results => {
      if (!chrome.runtime.lastError && results && results[0] && results[0].result) {
        allComments = results[0].result;
        chrome.storage.local.set({ [STORAGE_KEY]: allComments });
      }
      render();
    });
  } else {
    loadData(data => { allComments = data; render(); });
  }
});
