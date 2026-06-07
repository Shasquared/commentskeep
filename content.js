(function () {
  const STORAGE_KEY = 'commentkeep_saved';

  function getSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }

  function setSaved(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getVideoMeta() {
    const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim()
      || document.title.replace(' - YouTube', '').trim();
    const url = window.location.href.split('&')[0];
    const videoId = new URLSearchParams(window.location.search).get('v') || '';
    const thumb = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
    const ownerText = document.querySelector('ytd-video-owner-renderer')?.innerText?.trim() || '';
    const ownerLines = ownerText.split('\n').map(l => l.trim()).filter(Boolean);
    const channelName = ownerLines.length > 1 && ownerLines[1].toLowerCase().includes('more')
      ? ownerText.replace(/\n/g, ' ').trim()
      : ownerLines[0] || '';
    return { title, url, thumb, videoId, channelName };
  }

  function getCurrentTimestamp() {
    const video = document.querySelector('video');
    return video ? Math.floor(video.currentTime) : null;
  }

  function isAlreadySaved(commentText, videoUrl) {
    return getSaved().some(s => s.text === commentText && s.videoUrl === videoUrl);
  }

  function saveComment(commentText, authorName) {
    const saved = getSaved();
    const meta = getVideoMeta();
    const timestamp = getCurrentTimestamp();
    const entry = {
      id: Date.now().toString(),
      text: commentText,
      author: authorName,
      channelName: meta.channelName,
      videoTitle: meta.title,
      videoUrl: meta.url,
      videoThumb: meta.thumb,
      videoTimestamp: timestamp,
      savedAt: new Date().toISOString(),
      tags: []
    };
    saved.unshift(entry);
    setSaved(saved);
    return entry;
  }

  function removeComment(commentText, videoUrl) {
    setSaved(getSaved().filter(s => !(s.text === commentText && s.videoUrl === videoUrl)));
  }

  function bookmarkSVG(filled) {
    return filled
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
  }

  function createBookmarkBtn(commentText, authorName) {
    const btn = document.createElement('button');
    btn.className = 'ck-bookmark-btn';
    const isSaved = isAlreadySaved(commentText, getVideoMeta().url);
    btn.dataset.saved = isSaved ? 'true' : 'false';
    btn.setAttribute('aria-label', isSaved ? 'Remove saved comment' : 'Save comment');
    btn.innerHTML = bookmarkSVG(isSaved);

    btn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      const meta = getVideoMeta();
      if (btn.dataset.saved === 'true') {
        removeComment(commentText, meta.url);
        btn.dataset.saved = 'false';
        btn.innerHTML = bookmarkSVG(false);
        btn.setAttribute('aria-label', 'Save comment');
        showToast('Removed');
      } else {
        saveComment(commentText, authorName);
        btn.dataset.saved = 'true';
        btn.innerHTML = bookmarkSVG(true);
        btn.setAttribute('aria-label', 'Remove saved comment');
        showToast('Comment saved!');
      }
    });

    return btn;
  }

  function showToast(msg) {
    const existing = document.querySelector('.ck-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'ck-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('ck-toast--show'));
    setTimeout(() => {
      toast.classList.remove('ck-toast--show');
      setTimeout(() => toast.remove(), 300);
    }, 1800);
  }

  function injectButtons() {
    const threads = document.querySelectorAll('ytd-comment-thread-renderer, ytd-comment-renderer');
    threads.forEach(thread => {
      if (thread.querySelector('.ck-bookmark-btn')) return;

      const contentEl = thread.querySelector('#content-text');
      const authorEl = thread.querySelector('#author-text');
      if (!contentEl) return;

      const commentText = contentEl.textContent?.trim();
      const authorName = authorEl?.textContent?.trim() || 'Unknown';
      if (!commentText) return;

      const replyBtn = thread.querySelector('#reply-button-end, #reply-button, ytd-button-renderer#reply-button');
      const toolbar = thread.querySelector('#toolbar, #action-buttons');

      const btn = createBookmarkBtn(commentText, authorName);

      if (replyBtn && replyBtn.parentElement) {
        replyBtn.parentElement.insertBefore(btn, replyBtn.nextSibling);
      } else if (toolbar) {
        toolbar.appendChild(btn);
      }
    });
  }

  let observer = null;
  let debounceTimer = null;

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(injectButtons, 400);
    });
    const target = document.querySelector('ytd-comments') || document.body;
    observer.observe(target, { childList: true, subtree: true });
    injectButtons();
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startObserver);
    } else {
      startObserver();
    }
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(startObserver, 1500);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  init();
})();