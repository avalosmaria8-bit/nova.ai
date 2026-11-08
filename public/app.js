const storageKey = "nova-conversations-v1";
const themeKey = "nova-theme";
const state = {
  conversations: JSON.parse(localStorage.getItem(storageKey) || "[]"),
  activeId: null,
  sending: false,
};

const chat = document.querySelector("#chat");
const welcome = document.querySelector("#welcome");
const messagesEl = document.querySelector("#messages");
const historyEl = document.querySelector("#history");
const form = document.querySelector("#composer");
const input = document.querySelector("#message-input");
const send = document.querySelector("#send");
const title = document.querySelector("#conversation-title");
const indicator = document.querySelector("#mode-indicator");

function save() { localStorage.setItem(storageKey, JSON.stringify(state.conversations)); }
function active() { return state.conversations.find((item) => item.id === state.activeId); }
function escapeHtml(value) { const node = document.createElement("div"); node.textContent = value; return node.innerHTML; }
function scrollDown() { requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; }); }
function makeConversation() { const item = { id: crypto.randomUUID(), title: "New conversation", messages: [], createdAt: Date.now() }; state.conversations.unshift(item); state.activeId = item.id; save(); return item; }
function renderHistory() { historyEl.innerHTML = state.conversations.slice(0, 12).map((item) => `<button class="${item.id === state.activeId ? "active" : ""}" data-id="${item.id}">${escapeHtml(item.title)}</button>`).join(""); }
function setMode(mode = "checking") { indicator.className = `mode-indicator ${mode}`; indicator.innerHTML = `<span></span>${mode === "live" ? "Live AI" : mode === "demo" ? "Demo mode" : "Checking connection"}`; }
function render() {
  const conversation = active();
  const hasMessages = Boolean(conversation?.messages?.length);
  welcome.hidden = hasMessages;
  messagesEl.innerHTML = !hasMessages ? "" : conversation.messages.map((message) => `
    <article class="message ${message.role}">
      <div class="message-avatar">${message.role === "assistant" ? "N" : "M"}</div>
      <div class="message-body"><div class="message-name">${message.role === "assistant" ? "Nova" : "You"}</div><div class="message-text">${escapeHtml(message.content)}</div></div>
    </article>`).join("");
  title.textContent = conversation?.title || "New conversation";
  renderHistory();
  scrollDown();
}
function typing(show) { document.querySelector("#typing")?.remove(); if (show) { messagesEl.insertAdjacentHTML("beforeend", `<article class="message assistant" id="typing"><div class="message-avatar">N</div><div class="message-body"><div class="message-name">Nova</div><div class="typing"><span></span><span></span><span></span></div></div></article>`); scrollDown(); } }
function resizeInput() { input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight, 170)}px`; }
function closeMenu() { document.querySelector(".sidebar").classList.remove("open"); document.querySelector("#overlay").classList.remove("show"); }

async function ask(value) {
  const text = value.trim(); if (!text || state.sending) return;
  const conversation = active() || makeConversation();
  conversation.messages.push({ role: "user", content: text });
  if (conversation.title === "New conversation") conversation.title = text.slice(0, 38) + (text.length > 38 ? "…" : "");
  save(); input.value = ""; resizeInput(); state.sending = true; send.disabled = true; render(); typing(true);
  try {
    const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: conversation.messages }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Nova could not respond.");
    conversation.messages.push({ role: "assistant", content: data.reply });
    setMode(data.mode);
  } catch (error) { conversation.messages.push({ role: "assistant", content: `I’m sorry—${error.message}` }); }
  finally { state.sending = false; send.disabled = false; save(); typing(false); render(); input.focus(); }
}

document.querySelector("#new-chat").addEventListener("click", () => { makeConversation(); render(); input.focus(); closeMenu(); });
historyEl.addEventListener("click", (event) => { const id = event.target.dataset.id; if (!id) return; state.activeId = id; render(); closeMenu(); });
document.querySelectorAll(".prompt-card").forEach((button) => button.addEventListener("click", () => ask(button.dataset.prompt)));
form.addEventListener("submit", (event) => { event.preventDefault(); ask(input.value); });
input.addEventListener("input", resizeInput); input.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
document.querySelector("#attach").addEventListener("click", () => { input.placeholder = "File uploads are coming soon — tell Nova what you’d like to work on."; input.focus(); });
document.querySelector("#theme-toggle").addEventListener("click", () => { document.body.classList.toggle("dark"); localStorage.setItem(themeKey, document.body.classList.contains("dark") ? "dark" : "light"); });
document.querySelector("#menu-toggle").addEventListener("click", () => { document.querySelector(".sidebar").classList.add("open"); document.querySelector("#overlay").classList.add("show"); });
document.querySelector("#overlay").addEventListener("click", closeMenu);
window.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector("#new-chat").click(); } });
if (localStorage.getItem(themeKey) === "dark") document.body.classList.add("dark");
if (state.conversations.length) state.activeId = state.conversations[0].id;
else makeConversation();
render(); setMode("demo");
