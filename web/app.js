// Hinata Companion AI Web App Client Logic
document.addEventListener('DOMContentLoaded', () => {
  
  // --- Navigation & Views ---
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  const pageTitle = document.getElementById('page-title');

  const titles = {
    chat: 'Companion Chat',
    memory: 'Memory Vault',
    productivity: 'Productivity Hub',
    settings: 'Brain Settings'
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      navItems.forEach(n => n.classList.remove('active'));
      viewPanels.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(`${tab}-panel`).classList.add('active');
      pageTitle.textContent = titles[tab] || 'Companion Chat';

      // Load data on view activation
      if (tab === 'memory') loadMemoryFacts();
      if (tab === 'productivity') loadProductivityTasks();
      if (tab === 'settings') loadSettings();
    });
  });

  // Productivity Subtabs
  const prodTabs = document.querySelectorAll('.prod-tab-btn');
  const subtabContents = document.querySelectorAll('.subtab-content');

  prodTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const sub = tab.dataset.subtab;
      prodTabs.forEach(t => t.classList.remove('active'));
      subtabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(`${sub}-subtab`).classList.add('active');
    });
  });

  // --- Health Check ---
  async function checkHealth() {
    try {
      const res = await fetch('/health');
      const data = await res.json();
      if (data.status === 'healthy') {
        document.getElementById('health-status').textContent = 'Healthy';
      }
    } catch (e) {
      document.getElementById('health-status').textContent = 'Offline';
    }
  }
  checkHealth();
  setInterval(checkHealth, 30000);

  // --- 1. CHAT LOGIC ---
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const voiceBtn = document.getElementById('voice-record-btn');

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Append user message
    appendMessage('user', text);
    chatInput.value = '';

    // Show typing state
    const typingId = appendTypingIndicator();

    try {
      const res = await fetch('/api/v1/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      removeMessage(typingId);

      if (!res.ok) throw new Error('API request failed');

      const data = await res.json();
      appendMessage('assistant', data.reply || data.response, data.feeling, data.defense_mechanism, data.mood);

      // Update Top Header Mood Pill
      if (data.mood || data.feeling) {
        document.getElementById('mood-text').textContent = data.feeling || data.mood || 'Attuned';
      }
    } catch (err) {
      removeMessage(typingId);
      appendMessage('assistant', 'Sorry, I ran into an error processing that request. Please try again.');
    }
  }

  window.sendQuickPrompt = function(promptText) {
    chatInput.value = promptText;
    sendMessage();
  };

  function appendMessage(sender, text, feeling = null, defense = null, mood = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}-msg`;
    const avatar = sender === 'assistant' ? '🌸' : '👤';
    const name = sender === 'assistant' ? 'Hinata' : 'You';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let emotionHtml = '';
    if (sender === 'assistant' && (feeling || defense || mood)) {
      emotionHtml = `
        <div class="emotion-tags">
          ${feeling ? `<span class="tag feeling-tag">${feeling}</span>` : ''}
          ${mood ? `<span class="tag mood-tag">${mood}</span>` : ''}
          ${defense ? `<span class="tag mood-tag">${defense}</span>` : ''}
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div class="avatar">${avatar}</div>
      <div class="message-content">
        <div class="message-header">
          <span class="sender-name">${name}</span>
          <span class="time-stamp">${timeStr}</span>
        </div>
        <div class="text">${escapeHtml(text)}</div>
        ${emotionHtml}
      </div>
    `;

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function appendTypingIndicator() {
    const id = 'typing-' + Date.now();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message assistant-msg';
    msgDiv.id = id;
    msgDiv.innerHTML = `
      <div class="avatar">🌸</div>
      <div class="message-content">
        <div class="text" style="color: var(--text-dim);">Hinata is thinking...</div>
      </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return id;
  }

  function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  // Speech Recognition (Voice Input)
  let isRecording = false;
  let recognition = null;

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      chatInput.value = transcript;
      stopRecording();
    };

    recognition.onerror = () => stopRecording();
    recognition.onend = () => stopRecording();
  }

  voiceBtn.addEventListener('click', () => {
    if (!recognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  function startRecording() {
    isRecording = true;
    voiceBtn.classList.add('recording');
    recognition.start();
  }

  function stopRecording() {
    isRecording = false;
    voiceBtn.classList.remove('recording');
    try { recognition.stop(); } catch(e) {}
  }

  // --- 2. MEMORY VAULT ---
  const memoryGrid = document.getElementById('memory-facts-grid');
  const memoryModal = document.getElementById('add-memory-modal');
  const openMemoryModalBtn = document.getElementById('open-add-memory-btn');
  const closeMemoryModalBtn = document.getElementById('close-memory-modal');
  const cancelMemoryBtn = document.getElementById('cancel-memory-btn');
  const saveMemoryBtn = document.getElementById('save-memory-btn');
  const memorySearchBtn = document.getElementById('memory-search-btn');
  const memorySearchInput = document.getElementById('memory-search-input');

  openMemoryModalBtn.addEventListener('click', () => memoryModal.classList.add('active'));
  closeMemoryModalBtn.addEventListener('click', () => memoryModal.classList.remove('active'));
  cancelMemoryBtn.addEventListener('click', () => memoryModal.classList.remove('active'));

  saveMemoryBtn.addEventListener('click', async () => {
    const text = document.getElementById('memory-fact-text').value.trim();
    const category = document.getElementById('memory-category').value.trim() || 'general';
    if (!text) return;

    try {
      await fetch('/api/v1/memory/facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact: text, category })
      });
      memoryModal.classList.remove('active');
      document.getElementById('memory-fact-text').value = '';
      loadMemoryFacts();
    } catch (e) {
      alert('Failed to save memory fact.');
    }
  });

  memorySearchBtn.addEventListener('click', async () => {
    const query = memorySearchInput.value.trim();
    if (!query) {
      loadMemoryFacts();
      return;
    }
    try {
      const res = await fetch('/api/v1/memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const facts = await res.json();
      renderMemoryFacts(facts);
    } catch (e) {
      memoryGrid.innerHTML = `<div class="empty-state">Search failed.</div>`;
    }
  });

  async function loadMemoryFacts() {
    try {
      const res = await fetch('/api/v1/memory/facts');
      const facts = await res.json();
      renderMemoryFacts(facts);
    } catch (e) {
      memoryGrid.innerHTML = `<div class="empty-state">No memory facts found or error loading.</div>`;
    }
  }

  function renderMemoryFacts(facts) {
    if (!facts || facts.length === 0) {
      memoryGrid.innerHTML = `<div class="empty-state">No memory facts stored yet.</div>`;
      return;
    }

    memoryGrid.innerHTML = facts.map(f => `
      <div class="memory-card">
        <div>
          <span class="memory-category">${escapeHtml(f.category || 'FACT')}</span>
          <p class="memory-text">${escapeHtml(f.fact || f.content || f)}</p>
        </div>
        <div class="memory-footer">
          <span>Decay Aware</span>
          <button class="icon-btn" onclick="deleteMemoryFact('${f.id}')" title="Delete">
            <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
          </button>
        </div>
      </div>
    `).join('');
  }

  window.deleteMemoryFact = async function(id) {
    if (!id || id === 'undefined') return;
    if (!confirm('Delete this memory fact?')) return;
    try {
      await fetch(`/api/v1/memory/facts/${id}`, { method: 'DELETE' });
      loadMemoryFacts();
    } catch (e) {}
  };

  // --- 3. PRODUCTIVITY LOGIC ---
  const taskList = document.getElementById('task-items-list');
  const addTaskModal = document.getElementById('add-task-modal');
  const addTaskBtn = document.getElementById('add-task-btn');
  const closeTaskModalBtn = document.getElementById('close-task-modal');
  const cancelTaskBtn = document.getElementById('cancel-task-btn');
  const saveTaskBtn = document.getElementById('save-task-btn');

  addTaskBtn.addEventListener('click', () => addTaskModal.classList.add('active'));
  closeTaskModalBtn.addEventListener('click', () => addTaskModal.classList.remove('active'));
  cancelTaskBtn.addEventListener('click', () => addTaskModal.classList.remove('active'));

  saveTaskBtn.addEventListener('click', async () => {
    const title = document.getElementById('task-title-input').value.trim();
    const priority = document.getElementById('task-priority-input').value;
    if (!title) return;

    try {
      await fetch('/api/v1/productivity/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority })
      });
      addTaskModal.classList.remove('active');
      document.getElementById('task-title-input').value = '';
      loadProductivityTasks();
    } catch (e) {
      alert('Failed to save task.');
    }
  });

  async function loadProductivityTasks() {
    try {
      const res = await fetch('/api/v1/productivity/tasks');
      const tasks = await res.json();
      if (!tasks || tasks.length === 0) {
        taskList.innerHTML = `<div class="empty-state">No tasks created yet.</div>`;
        return;
      }
      taskList.innerHTML = tasks.map(t => `
        <div class="task-item ${t.completed ? 'completed' : ''}">
          <input type="checkbox" class="task-checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}', this.checked)">
          <span style="flex-grow: 1;">${escapeHtml(t.title)}</span>
          <span class="tag mood-tag">${t.priority || 'Medium'}</span>
        </div>
      `).join('');
    } catch (e) {
      taskList.innerHTML = `<div class="empty-state">No active tasks.</div>`;
    }
  }

  window.toggleTask = async function(id, completed) {
    try {
      await fetch(`/api/v1/productivity/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed })
      });
      loadProductivityTasks();
    } catch (e) {}
  };

  // --- 4. SETTINGS LOGIC ---
  const settingProvider = document.getElementById('setting-provider');
  const providerNamePill = document.getElementById('provider-name');

  settingProvider.addEventListener('change', () => {
    providerNamePill.textContent = settingProvider.options[settingProvider.selectedIndex].text.split(' ')[0];
  });

  async function loadSettings() {
    try {
      const res = await fetch('/api/v1/settings/');
      const data = await res.json();
      if (data.AI_PROVIDER) {
        settingProvider.value = data.AI_PROVIDER.toLowerCase();
        providerNamePill.textContent = data.AI_PROVIDER;
      }
      if (data.AI_MODEL) {
        document.getElementById('setting-model').value = data.AI_MODEL;
      }
    } catch (e) {}
  }

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const provider = settingProvider.value;
    const model = document.getElementById('setting-model').value;
    try {
      await fetch('/api/v1/settings/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ AI_PROVIDER: provider, AI_MODEL: model })
      });
      alert('Settings updated successfully!');
    } catch (e) {
      alert('Failed to update settings.');
    }
  });

  function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
});
