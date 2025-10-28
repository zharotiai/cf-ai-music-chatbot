/**
 * LLM Chat App Frontend
 *
 * Handles the chat UI interactions and communication with the backend API.
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Chat state
let chatHistory = [
  {
    role: "assistant",
    content:
      "Hey — I'm your Music Recommender. Tell me your vibe, artist, or a mood and I'll suggest songs, playlists, or artists you might like.",
  },
];
let isProcessing = false;

// Auto-resize textarea as user types
userInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";
});

// Send message on Enter (without Shift)
userInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Send button click handler
sendButton.addEventListener("click", sendMessage);

// Allow external example chips to optionally trigger send
window.useExample = function (text, send = false) {
  userInput.value = text;
  userInput.dispatchEvent(new Event('input'));
  userInput.focus();
  if (send) sendMessage();
};

/**
 * Sends a message to the chat API and processes the response
 */
async function sendMessage() {
  const message = userInput.value.trim();

  // Don't send empty messages
  if (message === "" || isProcessing) return;

  // Disable input while processing
  isProcessing = true;
  userInput.disabled = true;
  sendButton.disabled = true;

  // Add user message to chat
  addMessageToChat("user", message);

  // Clear input
  userInput.value = "";
  userInput.style.height = "auto";

  // Show typing indicator
  typingIndicator.classList.add("visible");

  // Add message to history
  chatHistory.push({ role: "user", content: message });

  try {
    // Create new assistant response element
  const assistantMessageEl = document.createElement("div");
  assistantMessageEl.className = "message assistant-message";
  // placeholder preview while streaming; will be replaced with formatted HTML when complete
  assistantMessageEl.innerHTML = `<div class="assistant-preview"></div>`;
    chatMessages.appendChild(assistantMessageEl);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Send request to API
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: chatHistory,
        persona: 'music', // prime backend with music recommender persona
      }),
    });

    // Handle errors
    if (!response.ok) {
      throw new Error("Failed to get response");
    }

    // Process streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode chunk
      const chunk = decoder.decode(value, { stream: true });

      // Process SSE format
      const lines = chunk.split("\n");
      for (const line of lines) {
        try {
          const jsonData = JSON.parse(line);
          if (jsonData.response) {
            // Append new content to existing text
            responseText += jsonData.response;
            // Update a plain-text preview while streaming
            const preview = assistantMessageEl.querySelector('.assistant-preview');
            if (preview) preview.textContent = responseText;

            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        } catch (e) {
          console.error("Error parsing JSON:", e);
        }
      }
    }

    // Replace preview with formatted assistant content
    const preview = assistantMessageEl.querySelector('.assistant-preview');
    if (preview) {
      // replace the inner HTML of the assistant message container with formatted content
      assistantMessageEl.querySelector('.assistant-preview').outerHTML = formatAssistantContent(responseText);
    }

    // Attach story cards (if tracks are present) under the assistant message
    try {
      attachStoryButtons(assistantMessageEl, responseText);
    } catch (e) {
      console.error('attachStoryButtons error', e);
    }

    // Add completed response to chat history
    chatHistory.push({ role: "assistant", content: responseText });
  } catch (error) {
    console.error("Error:", error);
    addMessageToChat(
      "assistant",
      "Sorry, there was an error processing your request.",
    );
  } finally {
    // Hide typing indicator
    typingIndicator.classList.remove("visible");

    // Re-enable input
    isProcessing = false;
    userInput.disabled = false;
    sendButton.disabled = false;
    userInput.focus();
  }
}

/**
 * Helper function to add message to chat
 */
function addMessageToChat(role, content) {
  const messageEl = document.createElement("div");
  messageEl.className = `message ${role}-message`;
  // If assistant content looks structured, render nicely
  if (role === 'assistant') {
    messageEl.innerHTML = `<div class="assistant-content">${formatAssistantContent(content)}</div>`;
    // Try to attach story cards for parsed tracks (if any)
    try {
      attachStoryButtons(messageEl, content);
    } catch (e) {
      console.error('attachStoryButtons error', e);
    }
  } else {
    // user messages keep simple paragraph
    messageEl.innerHTML = `<p>${escapeHtml(content)}</p>`;
  }
  chatMessages.appendChild(messageEl);

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Escape HTML to avoid injection in inserted content.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Try to render assistant output as a structured list or JSON.
 * Falls back to a paragraph if nothing structured is detected.
 */
function formatAssistantContent(text) {
  if (!text) return '';
  const trimmed = text.trim();

  // Try JSON parse first
  if ((trimmed.startsWith('{') || trimmed.startsWith('['))) {
    try {
      const obj = JSON.parse(trimmed);
      // If common 'ranked' field
      if (obj && Array.isArray(obj.ranked)) {
        return renderRankedArray(obj.ranked);
      }
      if (obj && Array.isArray(obj.results)) {
        return renderCandidatesArray(obj.results);
      }
      if (Array.isArray(obj)) {
        return renderGenericArray(obj);
      }
      // Fallback to pretty JSON block
      return `<pre style="white-space:pre-wrap">${escapeHtml(JSON.stringify(obj, null, 2))}</pre>`;
    } catch (e) {
      // not JSON, continue
    }
  }

  // Detect numbered or bullet lists
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // Detect separator-based lists (lines with ***** or ----- between items)
  const hasSeparator = lines.some(l => /^[\*\-]{3,}$/.test(l));
  if (hasSeparator) {
    // split on separator lines and treat each chunk as an item
    const parts = trimmed.split(/\r?\n(?:\*{3,}|\-{3,})\r?\n/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return `<ol>${parts.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ol>`;
    }
  }
  const numbered = lines.filter(l => /^\d+[\.)]/.test(l));
  const bullets = lines.filter(l => /^[\-\*•]/.test(l));

  if (numbered.length >= 2) {
    // Render as ordered list, stripping leading numbers
    const items = lines.map(l => l.replace(/^\d+[\.)]\s*/, ''));
    return `<ol>${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ol>`;
  }

  if (bullets.length >= 2) {
    const items = lines.map(l => l.replace(/^[\-\*•]\s*/, ''));
    return `<ul>${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
  }

  // Attempt to parse lines that look like "Title — Artist [genres] (tempo:xxx)"
  const parsedCandidates = lines.map(l => parseCandidateLine(l)).filter(Boolean);
  if (parsedCandidates.length >= 2) {
    return renderCandidatesArray(parsedCandidates);
  }

  // Default: simple paragraph, preserving line breaks
  return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br/>')}</p>`;
}

function parseCandidateLine(line) {
  // Example formats:
  // 1. Title — Artist [genre, genre] (tempo:120, energy:0.8) — reason
  // Title — Artist [genres]
  const m = line.match(/^(?:\d+[\.)]\s*)?(.+?)\s+[—-]\s+([^\[]+)(?:\s*\[([^\]]+)\])?(?:\s*\(([^\)]+)\))?(?:\s+[—-]\s+(.+))?$/);
  if (!m) return null;
  const title = m[1]?.trim();
  const artist = m[2]?.trim();
  const genres = m[3] ? m[3].split(',').map(s => s.trim()) : [];
  const meta = m[4] ? m[4].split(',').map(s => s.trim()) : [];
  const reason = m[5]?.trim() ?? '';
  const tempoMatch = meta.join(' ').match(/tempo\s*[:=]\s*(\d+)/i);
  const tempo = tempoMatch ? Number(tempoMatch[1]) : undefined;
  return { title, artist, genres, tempo, reason };
}

function renderRankedArray(arr) {
  // each item might be { index, reason }
  return `<ol>${arr.map(it => `<li>${escapeHtml(JSON.stringify(it))}</li>`).join('')}</ol>`;
}

function renderGenericArray(arr) {
  return `<ol>${arr.map(it => `<li>${escapeHtml(typeof it === 'string' ? it : JSON.stringify(it))}</li>`).join('')}</ol>`;
}

function renderCandidatesArray(arr) {
  // Each item may be a track object or a parsed candidate
  return `<ol>${arr.map(item => {
    const t = typeof item === 'string' ? { title: item } : item;
    const title = escapeHtml(t.title || 'Untitled');
    const artist = t.artist ? `<div class="meta">${escapeHtml(t.artist)}</div>` : '';
    const genres = t.genres && t.genres.length ? `<div class="meta">${escapeHtml((t.genres||[]).join(', '))}</div>` : '';
    const tempo = t.tempo ? `<div class="meta">tempo: ${escapeHtml(String(t.tempo))}</div>` : '';
    const reason = t.reason ? `<div class="reason">${escapeHtml(t.reason)}</div>` : '';
    return `<li style="margin-bottom:.5rem"><strong>${title}</strong>${artist}${genres}${tempo}${reason}</li>`;
  }).join('')}</ol>`;
}

// ---------------------------
// Story card helpers
// ---------------------------

/**
 * Parse simple "1. Title — Artist" lines or "Title — Artist" occurrences
 */
function parseTracksFromText(text) {
  const tracks = [];
  const lines = text.split(/\r?\n/);
  const lineRegex = /^\s*\d+\.\s*(.+?)\s*—\s*(.+?)(?:\s*\[|$)/;
  for (const line of lines) {
    const m = line.match(lineRegex);
    if (m) {
      tracks.push({ title: m[1].trim(), artist: m[2].trim() });
    }
  }

  // fallback: search for standalone "Title — Artist" patterns
  if (tracks.length === 0) {
    const regex = /([A-Za-z0-9'’:&,.!\-\s]{2,80})\s+—\s+([A-Za-z0-9'’:&,.!\-\s]{2,80})/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      tracks.push({ title: match[1].trim(), artist: match[2].trim() });
    }
  }

  return tracks;
}

/**
 * Attach story cards below an assistant message element
 */
function attachStoryButtons(assistantMessageEl, text) {
  const tracks = parseTracksFromText(text);
  if (!tracks || tracks.length === 0) return;

  const container = document.createElement('div');
  container.className = 'story-cards';
  container.style.marginTop = '0.75rem';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '0.5rem';

  tracks.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'story-card';
    card.style.padding = '0.6rem';
    card.style.borderRadius = '8px';
    card.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))';
    card.style.border = '1px solid rgba(255,255,255,0.03)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';

    const label = document.createElement('div');
    label.textContent = `${t.title} — ${t.artist}`;
    label.style.fontWeight = '600';
    label.style.marginBottom = '0.4rem';

    const btn = document.createElement('button');
    btn.textContent = 'Tell me the story';
    btn.className = 'story-btn';
    btn.style.alignSelf = 'flex-start';
    btn.style.padding = '0.4rem 0.6rem';
    btn.style.borderRadius = '999px';
    btn.style.border = 'none';
    btn.style.background = 'linear-gradient(90deg, #9b5cff, #ff6ad5)';
    btn.style.color = 'white';
    btn.style.cursor = 'pointer';

    const content = document.createElement('div');
    content.className = 'story-content';
    content.style.marginTop = '0.5rem';
    content.style.display = 'none';
    content.style.whiteSpace = 'pre-wrap';

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Loading…';
      try {
        const story = await fetchSongStory(t.title, t.artist);
        content.textContent = story;
        content.style.display = 'block';
        btn.style.display = 'none';
      } catch (e) {
        content.textContent = 'Sorry, could not load story.';
        content.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Tell me the story';
      }
    });

    card.appendChild(label);
    card.appendChild(btn);
    card.appendChild(content);
    container.appendChild(card);
  });

  assistantMessageEl.appendChild(container);
}

/**
 * Fetch a short story for a song by asking the chat endpoint with a focused prompt
 */
async function fetchSongStory(title, artist) {
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: `Write a short 2-3 sentence engaging story about the song "${title}" by ${artist}. Mention influences, notable facts, or recording anecdotes when possible.` },
        ],
        persona: 'music',
      }),
    });

    if (!resp.ok) throw new Error('Network error');

    // Read streamed response to completion
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }

    // Try to extract JSON-style streaming pieces, otherwise return raw text
    try {
      const lines = text.split('\n').filter(Boolean);
      let out = '';
      for (const line of lines) {
        try {
          const j = JSON.parse(line);
          if (j.response) out += j.response;
        } catch (e) {
          out += line + '\n';
        }
      }
      return out.trim();
    } catch (e) {
      return text.trim();
    }
  } catch (e) {
    console.error('fetchSongStory error', e);
    throw e;
  }
}


