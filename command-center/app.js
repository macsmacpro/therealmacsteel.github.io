const params = new URLSearchParams(window.location.search);
const token = params.get("token") || localStorage.getItem("openclaw_command_token") || "";
if (token) localStorage.setItem("openclaw_command_token", token);

const state = {
  data: null,
  selectedDepartment: "executive",
  voice: {
    recognition: null,
    listening: false,
    supported: false,
    transcript: "",
    finalTranscript: "",
    speakReplies: true,
    waveStarted: false,
  },
};

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(path, options = {}) {
  const headers = { "X-OpenClaw-Token": token, ...(options.headers || {}) };
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function kpi(label, value, className = "") {
  return `<article class="kpi ${className}"><strong>${esc(value)}</strong><span class="muted">${esc(label)}</span></article>`;
}

function mini(label, value) {
  return `<div class="mini-card"><strong>${esc(value)}</strong><span class="muted">${esc(label)}</span></div>`;
}

function actionItem(title, body, meta = "") {
  return `<article class="action-item"><strong>${esc(title)}</strong><p>${esc(body)}</p>${meta ? `<div class="meta">${meta}</div>` : ""}</article>`;
}

function departmentName(id) {
  const dept = (state.data?.departments || []).find((d) => d.id === id);
  return dept?.name || id.replaceAll("_", " ");
}

function renderNav(departments) {
  $("departmentNav").innerHTML = departments.map((d) => `
    <button class="nav-item ${d.id === state.selectedDepartment ? "active" : ""}" data-dept="${esc(d.id)}">
      <strong>${esc(d.name)}</strong><br><span>${esc(d.owner)}</span>
    </button>
  `).join("");
  $("departmentNav").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDepartment = button.dataset.dept;
      render();
    });
  });
}

function renderSelects(departments) {
  $("departmentSelect").innerHTML = [
    `<option value="all">All Departments</option>`,
    ...departments.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}</option>`),
  ].join("");
  $("departmentSelect").value = state.selectedDepartment;
}

function renderKpis(data) {
  const k = data.kpis || {};
  $("kpis").innerHTML = [
    kpi("Company Health", k.company_health ?? "unknown", Number(k.company_health) >= 90 ? "good" : "warn"),
    kpi("Revenue", k.revenue_total ?? "$0.00"),
    kpi("MRR", k.mrr ?? "$0.00"),
    kpi("Enabled Crons", k.crons_enabled ?? 0),
    kpi("Cron Failures", k.cron_failures ?? 0, Number(k.cron_failures) ? "bad" : "good"),
    kpi("PC Ollama", k.pc_ollama ?? "unknown", String(k.pc_ollama).toLowerCase() === "ok" ? "good" : "warn"),
    kpi("Telegram Interrupts 24h", k.telegram_immediate_24h ?? 0),
    kpi("Trading", k.trading_status ?? "unknown"),
  ].join("");
}

function renderCampaign(data) {
  const lane = data.lanes?.content_revenue_os || {};
  const summary = lane.summary || {};
  $("campaignTitle").textContent = lane.campaign || "No active campaign";
  $("campaignStatus").textContent = lane.status || "unknown";
  $("campaignSummary").innerHTML = Object.entries(summary).map(([key, value]) => mini(key.replaceAll("_", " "), value)).join("");
  $("agentActions").innerHTML = (lane.actions || []).slice(0, 8).map((a) => actionItem(`${a.owner} · ${a.priority}`, a.action, `<span>${esc(a.campaign_title || "")}</span>`)).join("") || actionItem("No actions", "The daily campaign lane has not published actions yet.");
}

function renderDepartments(data) {
  const departments = data.departments || [];
  const selected = departments.find((d) => d.id === state.selectedDepartment) || departments[0];
  $("departments").innerHTML = departments.map((d) => `
    <article class="department-card">
      <h3>${esc(d.name)}</h3>
      <p>${esc(d.purpose)}</p>
      <div class="meta">
        <span>Owner: ${esc(d.owner)}</span>
        <span>Crons: ${esc(d.cron_count)}</span>
        <span>Events 24h: ${esc(d.routed_events_24h)}</span>
      </div>
    </article>
  `).join("");
  if (selected) $("departmentSelect").value = selected.id;
}

function renderMarketAndOps(data) {
  const marketActions = data.lanes?.market_intelligence?.actions || [];
  $("marketActions").innerHTML = marketActions.slice(0, 7).map((a) => actionItem(`${a.priority || "review"} · ${a.owner || "market"}`, a.next_action || a.type || "Review action", `<span>${esc(a.target || "")}</span>`)).join("") || actionItem("No market actions", "Market intelligence is waiting for the next scan.");

  const cron = data.lanes?.cron || {};
  const trading = data.lanes?.trading || {};
  const items = [
    actionItem("Cron failures", `${cron.failing_count || 0} active failure records`, `<span>${esc(cron.enabled || 0)} enabled</span>`),
    actionItem("Trading status", trading.status || trading.health_status || "unknown", `<span>${esc((trading.hard_blocks || []).join(", ") || "no hard blocks listed")}</span>`),
    actionItem("Social lane", data.kpis?.social_ready || "unknown"),
  ];
  (cron.failing || []).slice(0, 5).forEach((f) => items.push(actionItem(`Cron: ${f.name}`, f.last_error || f.status, `<span>${esc(f.agent)}</span>`)));
  $("opsHealth").innerHTML = items.join("");
}

function renderAgents(data) {
  const agents = data.agents || [];
  $("agentCount").textContent = `${agents.length} agents`;
  $("agents").innerHTML = agents.map((a) => `
    <article class="agent-card">
      <h3>${esc(a.id)}</h3>
      <div class="meta">
        <span class="${a.has_soul ? "good" : "warn"}">SOUL ${a.has_soul ? "ok" : "missing"}</span>
        <span class="${a.has_ollama_auth ? "good" : "warn"}">Ollama ${a.has_ollama_auth ? "ok" : "missing"}</span>
        <span>${esc(a.updated)}</span>
      </div>
    </article>
  `).join("");
}

function renderCommands(data) {
  const commands = data.commands_recent || [];
  $("recentCommands").innerHTML = commands.slice().reverse().map((c) => actionItem(`${c.department} · ${c.status}`, c.text, `<span>${esc(c.created_at || "")}</span>`)).join("") || actionItem("No routed commands", "Use the command router to send a request to the agent structure.");
}

function renderVoiceStatus(data) {
  const voice = data.voice || {};
  const whisperReady = Boolean(voice.whisper_cpp?.available);
  const piperReady = Boolean(voice.piper?.available);
  const wakeReady = Boolean(voice.openwakeword?.available);
  const backend = whisperReady ? "Whisper Ready" : "Browser STT";
  $("voiceBackend").textContent = `${backend}${piperReady ? " + Piper" : ""}${wakeReady ? " + Wake" : ""}`;
  if (!state.voice.listening && !state.voice.transcript) {
    $("voiceState").textContent = state.voice.supported ? "Standing By" : "Voice Needs Browser Support";
  }
}

function render() {
  const data = state.data;
  if (!data) return;
  renderNav(data.departments || []);
  renderSelects(data.departments || []);
  renderKpis(data);
  renderCampaign(data);
  renderDepartments(data);
  renderMarketAndOps(data);
  renderAgents(data);
  renderCommands(data);
  renderVoiceStatus(data);
  $("refreshState").textContent = `Live · ${new Date(data.generated_at).toLocaleTimeString()}`;
}

async function loadState() {
  $("refreshState").textContent = "Refreshing";
  try {
    state.data = await api("/api/state");
    render();
  } catch (error) {
    $("refreshState").textContent = "Auth or server error";
    $("kpis").innerHTML = kpi("Command Center", "Locked", "bad");
  }
}

$("refreshButton").addEventListener("click", loadState);
$("commandForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("commandResult").textContent = "Routing...";
  try {
    const payload = {
      department: $("departmentSelect").value,
      target: $("targetSelect").value,
      text: $("commandText").value,
      mode: "internal",
    };
    const result = await api("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    $("commandResult").textContent = `Routed: ${result.command.lead_agent || result.command.status}`;
    $("commandText").value = "";
    await loadState();
  } catch (error) {
    $("commandResult").textContent = `Failed: ${error.message}`;
  }
});

function inferDepartmentFromText(text) {
  const lowered = text.toLowerCase();
  const patterns = {
    investment: ["trade", "trading", "alpaca", "stock", "option", "forex", "risk", "market"],
    marketing: ["seo", "content", "social", "campaign", "blog", "podcast", "rank", "website"],
    sales: ["lead", "crm", "client", "prospect", "outreach", "close", "proposal", "pipeline"],
    production: ["video", "audio", "visual", "asset", "creative", "publish", "thumbnail"],
    operations: ["cron", "service", "gateway", "backup", "error", "health", "automation"],
    procurement: ["tool", "source", "free", "install", "vendor", "procure", "replace"],
    business_development: ["opportunity", "business", "offer", "package", "monetize", "launch"],
    legal_compliance: ["legal", "compliance", "risk", "privacy", "claim", "policy", "terms"],
    accounting: ["revenue", "cost", "mrr", "profit", "invoice", "gumroad", "cash"],
    analytics_bi: ["analytics", "dashboard", "metric", "report", "trend", "kpi", "signal"],
    rd: ["research", "experiment", "evolve", "skill", "agent", "model", "improve"],
    logistics: ["tailscale", "bridge", "device", "pc", "m1", "queue", "browser"],
  };
  let best = ["executive", 0];
  Object.entries(patterns).forEach(([department, words]) => {
    const score = words.reduce((total, word) => total + (lowered.includes(word) ? 1 : 0), 0);
    if (score > best[1]) best = [department, score];
  });
  return best[0];
}

function updateVoicePulse(department) {
  $("voiceDeptPulse").textContent = departmentName(department);
  $("voiceDeptPulse").dataset.department = department;
}

async function speak(text) {
  if (!state.voice.speakReplies) return;
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "X-OpenClaw-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (response.ok) {
      const blob = await response.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
      return;
    }
  } catch {
    // Browser speech synthesis remains the free fallback when Piper is unavailable.
  }
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.98;
  utterance.pitch = 0.92;
  window.speechSynthesis.speak(utterance);
}

async function routeVoiceTranscript(text, confidence = null) {
  if (!text.trim()) return;
  const department = inferDepartmentFromText(text);
  updateVoicePulse(department);
  $("voiceState").textContent = "Routing";
  $("voiceResult").textContent = "Sending to department lead...";
  try {
    const result = await api("/api/voice-command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: text,
        confidence,
        department: "auto",
        target: "department",
        backend: "browser_speech_recognition",
      }),
    });
    const lead = result.command?.lead_agent || department;
    $("voiceState").textContent = "Routed";
    $("voiceResult").textContent = `Lead: ${lead}`;
    speak(result.reply || `Routed to ${lead}.`);
    await loadState();
  } catch (error) {
    $("voiceState").textContent = "Voice Route Failed";
    $("voiceResult").textContent = error.message;
  }
}

function drawWaveform() {
  const canvas = $("voiceWaveform");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  let tick = 0;
  function frame() {
    tick += 1;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = state.voice.listening ? "#00d4b8" : "rgba(159, 176, 195, 0.38)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const amp = state.voice.listening ? 26 : 9;
    for (let x = 0; x <= width; x += 6) {
      const wave = Math.sin((x + tick * 5) / 18) * amp + Math.sin((x + tick * 2) / 43) * (amp / 2);
      const y = height / 2 + wave;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    requestAnimationFrame(frame);
  }
  frame();
}

function setupVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.voice.supported = Boolean(Recognition);
  if (!state.voice.waveStarted) {
    state.voice.waveStarted = true;
    drawWaveform();
  }
  if (!Recognition) {
    $("voiceState").textContent = "Voice Needs Browser Support";
    $("voiceResult").textContent = "Use Chrome on localhost now; Whisper local STT is tracked in the backend.";
    $("voiceButton").disabled = true;
    return;
  }
  const recognition = new Recognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    state.voice.listening = true;
    state.voice.transcript = "";
    state.voice.finalTranscript = "";
    $("voiceButton").classList.add("listening");
    $("voiceState").textContent = "Listening";
    $("voiceTranscript").textContent = "Listening...";
    $("voiceResult").textContent = "";
  };
  recognition.onresult = (event) => {
    let interim = "";
    let finalText = "";
    let confidence = null;
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const alternative = result[0];
      if (result.isFinal) {
        finalText += alternative.transcript;
        confidence = alternative.confidence;
      } else {
        interim += alternative.transcript;
      }
    }
    if (finalText) state.voice.finalTranscript += finalText;
    const display = `${state.voice.finalTranscript} ${interim}`.trim();
    state.voice.transcript = display;
    $("voiceTranscript").textContent = display || "Listening...";
    updateVoicePulse(inferDepartmentFromText(display));
    state.voice.lastConfidence = confidence;
  };
  recognition.onerror = (event) => {
    $("voiceState").textContent = "Voice Error";
    $("voiceResult").textContent = event.error || "Speech recognition failed";
  };
  recognition.onend = () => {
    state.voice.listening = false;
    $("voiceButton").classList.remove("listening");
    const transcript = (state.voice.finalTranscript || state.voice.transcript || "").trim();
    if (transcript) routeVoiceTranscript(transcript, state.voice.lastConfidence);
    else $("voiceState").textContent = "Standing By";
  };
  state.voice.recognition = recognition;
}

$("voiceButton").addEventListener("click", () => {
  if (!state.voice.recognition || state.voice.listening) return;
  state.voice.recognition.start();
});

$("voiceSpeakToggle").addEventListener("click", () => {
  state.voice.speakReplies = !state.voice.speakReplies;
  $("voiceSpeakToggle").textContent = state.voice.speakReplies ? "Voice Reply On" : "Voice Reply Off";
});

setupVoice();
loadState();
