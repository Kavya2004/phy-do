/**
 * chat-history-manager.js
 * Manages per-user conversation persistence and the left sidebar UI.
 *
 * Public API (attached to window.chatHistoryManager):
 *   .init(email)              — called after login; loads sidebar + starts a fresh convo
 *   .getCurrentConvoId()      — returns active conversation _id
 *   .appendMessage(role, txt) — saves one message to the active convo
 *   .autoTitle(userMsg, botMsg) — generates + saves a title using Gemini after first exchange
 *   .loadConversation(id)     — switches context to a past conversation
 *   .startNewConversation()   — creates a new blank conversation and clears the chat
 */

(function () {
  const BACKEND = 'https://physics-ai-tutor.onrender.com';

  // ─── State ────────────────────────────────────────────────────────────────
  let _email = null;
  let _currentId = null;      // active conversation _id
  let _titleSet = false;       // has auto-title been generated for this convo?
  let _messageQueue = [];      // buffer while DB write is in-flight
  let _writing = false;
  let _sidebarVisible = false;
  let _ready = false;          // true once init() has completed and _currentId is set

  // ─── DOM helpers ──────────────────────────────────────────────────────────

  function getSidebar() { return document.getElementById('chatHistorySidebar'); }
  function getConvoList() { return document.getElementById('convoList'); }

  // ─── API wrappers ─────────────────────────────────────────────────────────

  async function apiGet(path) {
    const r = await fetch(`${BACKEND}${path}`);
    if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
    return r.json();
  }

  async function apiPost(path, body) {
    const r = await fetch(`${BACKEND}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`POST ${path} → ${r.status}`);
    return r.json();
  }

  async function apiPatch(path, body) {
    const r = await fetch(`${BACKEND}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`PATCH ${path} → ${r.status}`);
    return r.json();
  }

  async function apiDelete(path) {
    const r = await fetch(`${BACKEND}${path}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`DELETE ${path} → ${r.status}`);
    return r.json();
  }

  // ─── Sidebar UI ───────────────────────────────────────────────────────────

  function buildSidebar() {
    if (document.getElementById('chatHistorySidebar')) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'chatHistorySidebar';
    sidebar.className = 'ch-sidebar ch-sidebar--closed';
    sidebar.innerHTML = `
      <div class="ch-sidebar__header">
        <span class="ch-sidebar__title">💬 Conversations</span>
        <button class="ch-sidebar__close" id="chSidebarClose" title="Close">✕</button>
      </div>
      <button class="ch-new-btn" id="chNewBtn">＋ New Chat</button>
      <div class="ch-convo-list" id="convoList"></div>
    `;
    document.body.appendChild(sidebar);

    // Toggle button in the sign-out bar
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'chToggleBtn';
    toggleBtn.title = 'Chat history';
    toggleBtn.innerHTML = '📋 History';
    toggleBtn.style.cssText = `
      padding: 6px 14px; font-size: 13px; font-weight: 600;
      background: rgba(255,255,255,0.15); color: #fff;
      border: 1px solid rgba(255,255,255,0.4); border-radius: 6px;
      cursor: pointer; transition: background 0.2s;
    `;
    toggleBtn.onmouseover = () => toggleBtn.style.background = 'rgba(255,255,255,0.28)';
    toggleBtn.onmouseout  = () => toggleBtn.style.background = 'rgba(255,255,255,0.15)';
    toggleBtn.addEventListener('click', toggleSidebar);

    // Insert before the sign-out button
    const signOutBar = document.getElementById('signOutBar');
    if (signOutBar) {
      signOutBar.insertBefore(toggleBtn, signOutBar.querySelector('#signOutBtn'));
    }

    document.getElementById('chSidebarClose').addEventListener('click', closeSidebar);
    document.getElementById('chNewBtn').addEventListener('click', () => window.chatHistoryManager.startNewConversation());
  }

  function toggleSidebar() {
    _sidebarVisible ? closeSidebar() : openSidebar();
  }

  function openSidebar() {
    const s = getSidebar();
    if (!s) return;
    s.classList.remove('ch-sidebar--closed');
    s.classList.add('ch-sidebar--open');
    _sidebarVisible = true;
  }

  function closeSidebar() {
    const s = getSidebar();
    if (!s) return;
    s.classList.remove('ch-sidebar--open');
    s.classList.add('ch-sidebar--closed');
    _sidebarVisible = false;
  }

  function renderConvoList(convos) {
    const list = getConvoList();
    if (!list) return;
    list.innerHTML = '';
    if (convos.length === 0) {
      list.innerHTML = '<p class="ch-empty">No conversations yet.</p>';
      return;
    }
    convos.forEach(c => {
      const item = document.createElement('div');
      item.className = 'ch-convo-item' + (c._id === _currentId ? ' ch-convo-item--active' : '');
      item.dataset.id = c._id;

      const date = new Date(c.updatedAt);
      const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      item.innerHTML = `
        <div class="ch-convo-item__body">
          <span class="ch-convo-item__title">${escapeHtml(c.title || 'Conversation')}</span>
          <span class="ch-convo-item__date">${dateStr}</span>
        </div>
        <button class="ch-convo-item__del" data-id="${c._id}" title="Delete">🗑</button>
      `;

      item.querySelector('.ch-convo-item__body').addEventListener('click', () => {
        window.chatHistoryManager.loadConversation(c._id);
        closeSidebar();
      });

      item.querySelector('.ch-convo-item__del').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this conversation?')) return;
        await deleteConversation(c._id);
      });

      list.appendChild(item);
    });
  }

  function markActiveInList(id) {
    document.querySelectorAll('.ch-convo-item').forEach(el => {
      el.classList.toggle('ch-convo-item--active', el.dataset.id === id);
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ─── Conversation actions ─────────────────────────────────────────────────

  async function loadConvoList() {
    try {
      const list = await apiGet(`/api/chat-history?email=${encodeURIComponent(_email)}`);
      renderConvoList(list);
    } catch (e) {
      console.warn('[chat-history] loadConvoList failed:', e.message);
    }
  }

  async function createNewConvo() {
    try {
      const doc = await apiPost('/api/chat-history', { email: _email });
      _currentId = doc._id;
      _titleSet = false;
      return doc;
    } catch (e) {
      console.warn('[chat-history] createNewConvo failed:', e.message);
      _currentId = null;
      return null;
    }
  }

  async function deleteConversation(id) {
    try {
      await apiDelete(`/api/chat-history/${id}`);
      if (_currentId === id) {
        await startNewConversation();
      } else {
        await loadConvoList();
      }
    } catch (e) {
      console.warn('[chat-history] delete failed:', e.message);
    }
  }

  // ─── Message persistence (debounced batching) ─────────────────────────────

  async function flushQueue() {
    if (_writing || _messageQueue.length === 0 || !_currentId || !_ready) {
      console.log('[chat-history] flushQueue blocked:', { _writing, queueLen: _messageQueue.length, _currentId, _ready });
      return;
    }
    _writing = true;
    const batch = _messageQueue.splice(0, _messageQueue.length);
    console.log('[chat-history] flushing', batch.length, 'messages to convo', _currentId);
    try {
      await apiPatch(`/api/chat-history/${_currentId}/messages`, { messages: batch });
      console.log('[chat-history] flush OK');
    } catch (e) {
      console.warn('[chat-history] flush failed:', e.message);
      _messageQueue.unshift(...batch);
    }
    _writing = false;
    if (_messageQueue.length > 0) flushQueue();
  }

  // ─── Auto-title ───────────────────────────────────────────────────────────

  async function autoTitle(userMsg, botMsg) {
    if (_titleSet || !_currentId) return;
    _titleSet = true; // prevent duplicate calls
    try {
      const prompt = `Given this physics tutoring exchange, generate a short 4-7 word descriptive title (no quotes, no punctuation at end):\nStudent: ${userMsg}\nTutor: ${botMsg.substring(0, 300)}`;
      const r = await fetch(`${BACKEND}/api/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'Generate a very short title (4-7 words, no quotes). Return ONLY the title text.' },
            { role: 'user', content: prompt }
          ]
        })
      });
      const data = await r.json();
      const title = (data.response || '').trim().replace(/^["']|["']$/g, '').substring(0, 60) || 'Physics Discussion';
      await apiPatch(`/api/chat-history/${_currentId}/title`, { title });
      // Update sidebar — reload full list so date/order is correct
      await loadConvoList();
      markActiveInList(_currentId);
    } catch (e) {
      console.warn('[chat-history] autoTitle failed:', e.message);
    }
  }

  // ─── Load a past conversation into the chat UI ─────────────────────────────

  async function loadConversation(id) {
    try {
      const doc = await apiGet(`/api/chat-history/${id}`);
      _currentId = id;
      _titleSet = true; // existing convo already has a title

      // Clear chat UI
      const chatMessages = document.getElementById('chatMessages');
      if (chatMessages) chatMessages.innerHTML = '';

      // Restore the tutor-chat context array (keep only the system prompt)
      if (window._resetChatContext) window._resetChatContext();

      // Replay messages in the UI
      doc.messages.forEach(msg => {
        if (window._addMessageSilent) {
          window._addMessageSilent(msg.content, msg.role === 'user' ? 'user' : 'bot');
        }
      });

      // Rebuild context from stored messages for AI continuity
      if (window._rebuildContext) window._rebuildContext(doc.messages);

      markActiveInList(id);
    } catch (e) {
      console.warn('[chat-history] loadConversation failed:', e.message);
    }
  }

  // ─── Start a brand-new conversation ───────────────────────────────────────

  async function startNewConversation() {
    // Clear chat UI
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) chatMessages.innerHTML = '';

    // Reset AI context
    if (window._resetChatContext) window._resetChatContext();

    // Greet
    if (window.addMessage) {
      window.addMessage("Hi there! I'm your physics tutor! Ask me anything about physics!", 'bot');
    }

    // Create DB record
    _ready = false;
    await createNewConvo();
    await loadConvoList();
    _ready = true;
    markActiveInList(_currentId);
    if (_messageQueue.length > 0) flushQueue();
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async function init(email) {
    _email = email;
    console.log('[chat-history] init started for', email);
    buildSidebar();
    await loadConvoList();
    await createNewConvo();
    _ready = true;
    console.log('[chat-history] init done, _currentId:', _currentId, 'queue size:', _messageQueue.length);
    markActiveInList(_currentId);
    if (_messageQueue.length > 0) flushQueue();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  window.chatHistoryManager = {
    init,
    getCurrentConvoId: () => _currentId,
    appendMessage(role, content) {
      // Always queue — flushQueue will wait until _ready and _currentId are set
      console.log('[chat-history] appendMessage queued:', role, content.substring(0, 40), '| ready:', _ready, '| id:', _currentId);
      _messageQueue.push({ role, content, timestamp: new Date() });
      setTimeout(flushQueue, 800);
    },
    autoTitle,
    loadConversation,
    startNewConversation,
    refreshList: loadConvoList,
  };

})();
