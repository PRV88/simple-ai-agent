/**
 * Simple AI Agent - Universal Embeddable Chat Widget
 * Self-contained, isolated via Shadow DOM, and powered by the Two-Route SSE Streaming Pattern.
 */
(function () {
  "use strict";

  // Prevent double injection
  if (window.__SIMPLE_AI_WIDGET_LOADED__) return;
  window.__SIMPLE_AI_WIDGET_LOADED__ = true;

  // Locate the script tag that loaded this script
  const scriptTag =
    document.currentScript ||
    document.querySelector("script[data-agent-id]") ||
    document.querySelector("script[src*='chat-widget.js']");

  const agentId = scriptTag ? scriptTag.getAttribute("data-agent-id") : null;
  const scriptSrc = scriptTag ? scriptTag.getAttribute("src") || "" : "";

  let defaultApiBase = "";
  try {
    if (scriptSrc.startsWith("http")) {
      const parsed = new URL(scriptSrc);
      defaultApiBase = parsed.origin;
    } else if (typeof window !== "undefined" && window.location && window.location.origin) {
      defaultApiBase = window.location.origin;
    }
  } catch (e) {
    // fallback
  }

  const apiBase = (scriptTag ? scriptTag.getAttribute("data-api-base") : null) || defaultApiBase || "https://simple-ai-agent-six.vercel.app";
  const position = (scriptTag ? scriptTag.getAttribute("data-position") : null) || "bottom-right";

  // State
  let config = {
    title: "AI Assistant",
    welcome_message: "Hello! How can I help you today?",
    brand_color: "#1976d2",
    starter_prompts: [],
  };

  let isOpen = false;
  let isLoading = false;
  let currentSessionId = null;
  let eventSource = null;
  let messages = [];

  // Create Container & Shadow DOM
  const container = document.createElement("div");
  container.id = "simple-ai-chat-widget-root";
  document.body.appendChild(container);

  const shadow = container.attachShadow({ mode: "open" });

  // Modern Non-Material Stylesheet (Sleek Studio Design)
  const style = document.createElement("style");
  style.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", "Inter", "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .widget-container {
      position: fixed;
      ${position === "bottom-left" ? "left: 24px;" : "right: 24px;"}
      bottom: 24px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: ${position === "bottom-left" ? "flex-start" : "flex-end"};
    }

    /* Floating Action Launcher - Modern Rounded Squircle Orb */
    .widget-fab {
      position: relative;
      width: 56px;
      height: 56px;
      border-radius: 18px;
      background: linear-gradient(135deg, var(--brand-color, #4f46e5) 0%, #312e81 100%);
      color: #ffffff;
      border: none;
      box-shadow: 0 10px 25px -4px rgba(79, 70, 229, 0.42), 0 4px 10px -2px rgba(15, 23, 42, 0.16);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s ease;
      outline: none;
    }

    .widget-fab:hover {
      transform: translateY(-2px) scale(1.04);
      box-shadow: 0 14px 30px -4px rgba(79, 70, 229, 0.52), 0 6px 14px -2px rgba(15, 23, 42, 0.2);
    }

    .widget-fab:active {
      transform: translateY(0) scale(0.97);
    }

    .widget-fab svg {
      width: 26px;
      height: 26px;
      fill: none;
      stroke: #ffffff;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: transform 0.2s ease;
    }

    .launcher-ping {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #10b981;
      border: 2px solid #ffffff;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
    }

    /* Chat Window Container */
    .chat-window {
      width: 395px;
      height: 610px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 100px);
      background: #ffffff;
      border-radius: 22px;
      box-shadow: 0 24px 56px -12px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(226, 232, 240, 0.85);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      margin-bottom: 14px;
      opacity: 0;
      transform: scale(0.95) translateY(14px);
      transform-origin: ${position === "bottom-left" ? "bottom left" : "bottom right"};
      pointer-events: none;
      transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .chat-window.open {
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }

    /* Header - Clean Studio Look */
    .chat-header {
      background: #ffffff;
      padding: 16px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #f1f5f9;
      user-select: none;
    }

    .chat-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .chat-header-avatar {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--brand-color, #4f46e5) 0%, #312e81 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px -2px rgba(79, 70, 229, 0.3);
      flex-shrink: 0;
    }

    .chat-header-avatar svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: #ffffff;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .chat-header-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.25;
      letter-spacing: -0.01em;
    }

    .chat-header-status {
      margin-top: 3px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #ecfdf5;
      padding: 2px 7px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      color: #047857;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
      display: inline-block;
    }

    .chat-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .chat-header-btn {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #64748b;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      outline: none;
    }

    .chat-header-btn:hover {
      background: #f1f5f9;
      color: #0f172a;
      border-color: #cbd5e1;
    }

    .chat-header-btn svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Messages Stream Container */
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 18px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: #fafafa;
    }

    .message-row {
      display: flex;
      flex-direction: column;
      max-width: 88%;
      animation: messageFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes messageFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message-row.user {
      align-self: flex-end;
      align-items: flex-end;
    }

    .message-row.agent {
      align-self: flex-start;
      align-items: flex-start;
    }

    .message-bubble {
      padding: 12px 16px;
      font-size: 13.5px;
      line-height: 1.55;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .message-row.user .message-bubble {
      background: linear-gradient(135deg, var(--brand-color, #4f46e5) 0%, #312e81 100%);
      color: #ffffff;
      border-radius: 18px 18px 4px 18px;
      box-shadow: 0 4px 14px -3px rgba(79, 70, 229, 0.35);
    }

    .message-row.agent .message-bubble {
      background: #ffffff;
      color: #1e293b;
      border: 1px solid #edf2f7;
      border-radius: 18px 18px 18px 4px;
      box-shadow: 0 2px 8px -2px rgba(15, 23, 42, 0.05);
    }

    /* Citations / Grounded References */
    .citations-container {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
    }

    .citations-header {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 5px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
    }

    .citation-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 9px;
      overflow: hidden;
      transition: all 0.15s ease;
    }

    .citation-card:hover {
      border-color: #cbd5e1;
      background: #f1f5f9;
    }

    .citation-card-header {
      padding: 7px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      font-size: 11.5px;
      color: #334155;
      font-weight: 500;
      user-select: none;
    }

    .citation-card-left {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .citation-card-left svg {
      width: 13px;
      height: 13px;
      stroke: var(--brand-color, #4f46e5);
      stroke-width: 2;
      fill: none;
      flex-shrink: 0;
    }

    .citation-source-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
      color: #1e293b;
    }

    .citation-score-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
      background: #e0e7ff;
      color: #3730a3;
      margin-left: 6px;
      flex-shrink: 0;
    }

    .citation-toggle-icon {
      font-size: 10px;
      color: #94a3b8;
      transition: transform 0.2s ease;
      margin-left: 6px;
      flex-shrink: 0;
    }

    .citation-card.expanded .citation-toggle-icon {
      transform: rotate(180deg);
    }

    .citation-card-body {
      display: none;
      padding: 8px 10px;
      font-size: 11px;
      line-height: 1.45;
      color: #475569;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .citation-card.expanded .citation-card-body {
      display: block;
    }

    /* Starter Prompts - Modern Interactive Cards */
    .starter-prompts {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 10px;
      width: 100%;
    }

    .starter-chip {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      color: #334155;
      font-size: 12.5px;
      font-weight: 500;
      padding: 9px 13px;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      text-align: left;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
    }

    .starter-chip:hover {
      background: #ffffff;
      border-color: var(--brand-color, #4f46e5);
      color: var(--brand-color, #4f46e5);
      transform: translateY(-1px) translateX(2px);
      box-shadow: 0 4px 12px -2px rgba(79, 70, 229, 0.12);
    }

    .starter-chip-arrow {
      font-size: 13px;
      opacity: 0.6;
    }

    /* Thinking / Searching Indicator (Non-empty dynamic state) */
    .thinking-box {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 13px;
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
      color: #64748b;
      font-size: 12px;
      font-weight: 500;
    }

    .thinking-dots {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .typing-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--brand-color, #4f46e5);
      animation: pulseDot 1.4s infinite ease-in-out both;
    }

    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }
    .typing-dot:nth-child(3) { animation-delay: 0s; }

    @keyframes pulseDot {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
      40% { transform: scale(1.1); opacity: 1; }
    }

    /* Input area - Sleek Capsule Design */
    .chat-input-area {
      padding: 12px 14px;
      background: #ffffff;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .chat-input {
      flex: 1;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 13.5px;
      color: #0f172a;
      outline: none;
      transition: all 0.15s ease;
    }

    .chat-input::placeholder {
      color: #94a3b8;
    }

    .chat-input:focus {
      background: #ffffff;
      border-color: var(--brand-color, #4f46e5);
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
    }

    .chat-send-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, var(--brand-color, #4f46e5) 0%, #3730a3 100%);
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      outline: none;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
    }

    .chat-send-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(79, 70, 229, 0.35);
    }

    .chat-send-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }

    .chat-send-btn svg {
      width: 17px;
      height: 17px;
      fill: none;
      stroke: #ffffff;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .widget-branding {
      font-size: 11px;
      font-weight: 500;
      text-align: center;
      color: #94a3b8;
      padding: 6px 12px 8px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      border-top: 1px solid rgba(241, 245, 249, 0.7);
    }

    .widget-branding svg {
      width: 12px;
      height: 12px;
      fill: none;
      stroke: #10b981;
      stroke-width: 2;
    }
  `;

  shadow.appendChild(style);

  // Widget DOM Structure (Studio Look)
  const root = document.createElement("div");
  root.className = "widget-container";
  root.innerHTML = `
    <div class="chat-window" id="chatWindow">
      <div class="chat-header">
        <div class="chat-header-info">
          <div class="chat-header-avatar">
            <svg viewBox="0 0 24 24">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
            </svg>
          </div>
          <div>
            <div class="chat-header-title" id="widgetTitle">AI Assistant</div>
            <div class="chat-header-status">
              <span class="status-dot"></span>
              <span>Online • Grounded RAG</span>
            </div>
          </div>
        </div>
        <div class="chat-header-actions">
          <button class="chat-header-btn" id="resetBtn" title="Reset Conversation">
            <svg viewBox="0 0 24 24">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
          </button>
          <button class="chat-header-btn" id="closeBtn" title="Close Chat">
            <svg viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="chat-messages" id="messagesContainer">
        <!-- Injected dynamically -->
      </div>

      <div class="chat-input-area">
        <input type="text" class="chat-input" id="chatInput" placeholder="Ask a question..." autocomplete="off" />
        <button class="chat-send-btn" id="sendBtn" title="Send message">
          <svg viewBox="0 0 24 24">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
        </button>
      </div>
      <div class="widget-branding">
        <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        Powered by Simple AI • Verified Knowledge
      </div>
    </div>

    <button class="widget-fab" id="launcherBtn" aria-label="Open Chat">
      <span class="launcher-ping"></span>
      <svg id="launcherIconOpen" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <svg id="launcherIconClose" viewBox="0 0 24 24" style="display: none;">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  shadow.appendChild(root);

  // Element handles
  const chatWindow = shadow.getElementById("chatWindow");
  const launcherBtn = shadow.getElementById("launcherBtn");
  const launcherIconOpen = shadow.getElementById("launcherIconOpen");
  const launcherIconClose = shadow.getElementById("launcherIconClose");
  const closeBtn = shadow.getElementById("closeBtn");
  const resetBtn = shadow.getElementById("resetBtn");
  const widgetTitle = shadow.getElementById("widgetTitle");
  const messagesContainer = shadow.getElementById("messagesContainer");
  const chatInput = shadow.getElementById("chatInput");
  const sendBtn = shadow.getElementById("sendBtn");

  // Apply Brand Color
  function applyBrandColor(color) {
    if (!color) return;
    root.style.setProperty("--brand-color", color);
  }

  // Toggle Visibility
  function toggleWidget(forceState) {
    isOpen = typeof forceState === "boolean" ? forceState : !isOpen;
    if (isOpen) {
      chatWindow.classList.add("open");
      launcherIconOpen.style.display = "none";
      launcherIconClose.style.display = "block";
      setTimeout(() => chatInput.focus(), 250);
    } else {
      chatWindow.classList.remove("open");
      launcherIconOpen.style.display = "block";
      launcherIconClose.style.display = "none";
    }
  }

  launcherBtn.addEventListener("click", () => toggleWidget());
  closeBtn.addEventListener("click", () => toggleWidget(false));

  // Create Citation Element with Expandable Excerpt
  function createCitationElement(cit) {
    const card = document.createElement("div");
    card.className = "citation-card";

    const header = document.createElement("div");
    header.className = "citation-card-header";
    header.innerHTML = `
      <div class="citation-card-left">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        <span class="citation-source-name">${escapeHtml(cit.source || "Document Reference")}</span>
        <span class="citation-score-badge">${Math.round((cit.similarity || 0) * 100)}% match</span>
      </div>
      <span class="citation-toggle-icon">▼</span>
    `;

    const body = document.createElement("div");
    body.className = "citation-card-body";
    body.textContent = cit.content_preview || "Relevant grounding passage retrieved from vector knowledge base.";

    header.addEventListener("click", () => {
      card.classList.toggle("expanded");
    });

    card.appendChild(header);
    card.appendChild(body);
    return card;
  }

  // Render Messages
  function renderMessages() {
    messagesContainer.innerHTML = "";

    messages.forEach((msg, idx) => {
      const row = document.createElement("div");
      row.className = `message-row ${msg.sender}`;

      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      bubble.textContent = msg.text;
      row.appendChild(bubble);

      // Render citations if any
      if (msg.citations && msg.citations.length > 0) {
        const citContainer = document.createElement("div");
        citContainer.className = "citations-container";

        const citHeader = document.createElement("div");
        citHeader.className = "citations-header";
        citHeader.innerHTML = `
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"></path>
          </svg>
          <span>Grounded Sources (${msg.citations.length})</span>
        `;
        citContainer.appendChild(citHeader);

        msg.citations.forEach((cit) => {
          citContainer.appendChild(createCitationElement(cit));
        });
        row.appendChild(citContainer);
      }

      // If it's the welcome message, render starter chips below it
      if (idx === 0 && config.starter_prompts && config.starter_prompts.length > 0 && messages.length === 1) {
        const chipsContainer = document.createElement("div");
        chipsContainer.className = "starter-prompts";
        config.starter_prompts.forEach((promptText) => {
          const chip = document.createElement("button");
          chip.className = "starter-chip";
          chip.innerHTML = `<span>${escapeHtml(promptText)}</span><span class="starter-chip-arrow">→</span>`;
          chip.addEventListener("click", () => {
            sendUserMessage(promptText);
          });
          chipsContainer.appendChild(chip);
        });
        row.appendChild(chipsContainer);
      }

      messagesContainer.appendChild(row);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function resetConversation() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    isLoading = false;
    currentSessionId = null;
    messages = [
      {
        sender: "agent",
        text: config.welcome_message || "Hello! How can I help you today?",
        citations: [],
      },
    ];
    renderMessages();
  }

  resetBtn.addEventListener("click", resetConversation);

  // Smooth Direct Streaming Implementation (No DOM thrashing, No empty bubbles)
  async function sendUserMessage(text) {
    const trimmed = (text || "").trim();
    if (!trimmed || isLoading) return;

    const targetAgentId = agentId || config.agent_id || "default";

    chatInput.value = "";
    messages.push({ sender: "user", text: trimmed });
    isLoading = true;
    renderMessages();

    // Create Dedicated Streaming Elements in DOM
    const streamingRow = document.createElement("div");
    streamingRow.className = "message-row agent";

    const thinkingBox = document.createElement("div");
    thinkingBox.className = "thinking-box";
    thinkingBox.innerHTML = `
      <div class="thinking-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <span>Searching knowledge & reasoning...</span>
    `;
    streamingRow.appendChild(thinkingBox);

    const streamingBubble = document.createElement("div");
    streamingBubble.className = "message-bubble";
    streamingBubble.style.display = "none";
    streamingRow.appendChild(streamingBubble);

    const citationsContainer = document.createElement("div");
    citationsContainer.className = "citations-container";
    citationsContainer.style.display = "none";
    streamingRow.appendChild(citationsContainer);

    messagesContainer.appendChild(streamingRow);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    let activeText = "";
    let activeCitations = [];
    let isCommitted = false;

    function renderActiveCitations(citations) {
      if (!Array.isArray(citations) || citations.length === 0) return;
      activeCitations = citations;
      citationsContainer.innerHTML = "";

      const citHeader = document.createElement("div");
      citHeader.className = "citations-header";
      citHeader.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"></path>
        </svg>
        <span>Grounded Sources (${citations.length})</span>
      `;
      citationsContainer.appendChild(citHeader);

      citations.forEach((cit) => {
        citationsContainer.appendChild(createCitationElement(cit));
      });
      citationsContainer.style.display = "flex";
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    try {
      const streamUrl =
        `${apiBase}/widget/chat/stream?agent_id=${encodeURIComponent(targetAgentId)}&query=${encodeURIComponent(trimmed)}` +
        (currentSessionId ? `&session_id=${encodeURIComponent(currentSessionId)}` : "");

      eventSource = new EventSource(streamUrl);

      eventSource.onmessage = function (event) {
        const raw = event.data;
        if (raw === "[DONE]") {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isCommitted && activeText) {
            isCommitted = true;
            messages.push({
              sender: "agent",
              text: activeText,
              citations: activeCitations,
            });
            renderMessages();
          }
          isLoading = false;
          return;
        }

        try {
          const payload = JSON.parse(raw);
          if (payload.type === "citations" && Array.isArray(payload.citations)) {
            renderActiveCitations(payload.citations);
          } else if (payload.type === "delta" && payload.delta) {
            // Reveal bubble, hide thinking box
            if (thinkingBox.style.display !== "none") {
              thinkingBox.style.display = "none";
              streamingBubble.style.display = "block";
            }
            activeText += payload.delta;
            streamingBubble.textContent = activeText;
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          } else if (payload.type === "done") {
            if (payload.message) {
              activeText = payload.message;
              streamingBubble.textContent = activeText;
            }
            if (payload.citations) {
              renderActiveCitations(payload.citations);
            }
            if (!isCommitted) {
              isCommitted = true;
              messages.push({
                sender: "agent",
                text: activeText || "No response generated.",
                citations: activeCitations,
              });
              renderMessages();
            }
            isLoading = false;
          } else if (payload.type === "error" && payload.error) {
            if (thinkingBox.style.display !== "none") {
              thinkingBox.style.display = "none";
              streamingBubble.style.display = "block";
            }
            activeText += `\n[Error: ${payload.error}]`;
            streamingBubble.textContent = activeText;
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        } catch (e) {
          console.error("Simple AI SSE Parse Error:", e);
        }
      };

      eventSource.onerror = function () {
        if (eventSource && eventSource.readyState === EventSource.CLOSED) return;
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        isLoading = false;
        if (thinkingBox.style.display !== "none") {
          thinkingBox.style.display = "none";
          streamingBubble.style.display = "block";
        }
        if (!activeText) {
          activeText = "Connection lost. Please try again.";
          streamingBubble.textContent = activeText;
        }
        if (!isCommitted) {
          isCommitted = true;
          messages.push({
            sender: "agent",
            text: activeText,
            citations: activeCitations,
          });
        }
      };
    } catch (err) {
      isLoading = false;
      if (thinkingBox.style.display !== "none") {
        thinkingBox.style.display = "none";
        streamingBubble.style.display = "block";
      }
      activeText = `Error: ${err.message}`;
      streamingBubble.textContent = activeText;
      if (!isCommitted) {
        isCommitted = true;
        messages.push({
          sender: "agent",
          text: activeText,
          citations: activeCitations,
        });
      }
    }
  }

  // Handle Input submission
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendUserMessage(chatInput.value);
    }
  });

  sendBtn.addEventListener("click", () => {
    sendUserMessage(chatInput.value);
  });

  // Load Remote Agent Configuration
  async function loadConfig() {
    const targetAgentId = agentId || "default";

    try {
      const res = await fetch(`${apiBase}/widget/config?agent_id=${encodeURIComponent(targetAgentId)}`);
      if (res.ok) {
        const data = await res.json();
        config = {
          title: data.title || "AI Assistant",
          welcome_message: data.welcome_message || "Hello! How can I help you today?",
          brand_color: data.brand_color || "#1976d2",
          starter_prompts: Array.isArray(data.starter_prompts) ? data.starter_prompts : [],
          agent_id: data.agent_id,
        };

        widgetTitle.textContent = config.title;
        applyBrandColor(config.brand_color);
      }
    } catch (e) {
      console.warn("Simple AI Widget: Failed to load config, using defaults.", e);
    }

    resetConversation();
  }

  // Expose Global API for programmatic control
  window.SimpleAIChatWidget = {
    open: () => toggleWidget(true),
    close: () => toggleWidget(false),
    toggle: () => toggleWidget(),
    sendMessage: (text) => sendUserMessage(text),
    reloadConfig: () => loadConfig(),
  };

  // Initialize
  loadConfig();
})();
