async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.message) message = data.message;
    } catch (_) {}
    throw new Error(message);
  }
  return res.json();
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Tabs ---
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "videos") loadRequests();
    if (btn.dataset.tab === "blogs") loadBlogRequests();
  });
});

// --- Videos ---
async function createRequest() {
  const topic = document.getElementById("topic").value.trim();
  const language = document.getElementById("language").value;
  const msg = document.getElementById("createMsg");
  msg.textContent = "";

  if (!topic) {
    msg.textContent = "Topic is required";
    return;
  }

  try {
    const result = await api("/api/requests", {
      method: "POST",
      body: JSON.stringify({ topic, language, source: "ui" })
    });
    msg.textContent = result.webhookWarning
      ? `Saved, but n8n: ${result.webhookWarning}`
      : "Video request submitted and n8n triggered.";
    document.getElementById("topic").value = "";
    await loadRequests();
  } catch (error) {
    msg.textContent = error.message;
  }
}

async function sendDecision(id, decision) {
  const notes = prompt("Optional notes for reviewer:", "") || "";
  const result = await api(`/api/reviews/${id}`, {
    method: "POST",
    body: JSON.stringify({ decision, notes })
  });
  if (result.webhookWarning) {
    alert(`Review saved with warning: ${result.webhookWarning}`);
  }
  await loadRequests();
}

function renderRequest(req) {
  const wrapper = document.createElement("div");
  wrapper.className = "request";
  wrapper.innerHTML = `
    <div><strong>Topic:</strong> ${escapeHtml(req.topic)}</div>
    <div><strong>Language:</strong> ${escapeHtml(req.language)}</div>
    <div><strong>Status:</strong> <span class="status">${escapeHtml(req.status)}</span></div>
    ${
      req.previewUrl
        ? `<video controls src="${escapeHtml(req.previewUrl)}"${req.thumbnailUrl ? ` poster="${escapeHtml(req.thumbnailUrl)}"` : ""}></video>`
        : req.thumbnailUrl
          ? `<div class="thumb-only"><img src="${escapeHtml(req.thumbnailUrl)}" alt="Thumbnail" /></div>`
          : "<div>No preview yet</div>"
    }
  `;

  if (req.status === "pending_review") {
    const btnRow = document.createElement("div");
    btnRow.className = "row";
    const approveBtn = document.createElement("button");
    approveBtn.textContent = "Approve";
    approveBtn.onclick = () => sendDecision(req._id, "approved");
    const rejectBtn = document.createElement("button");
    rejectBtn.className = "danger";
    rejectBtn.textContent = "Reject";
    rejectBtn.onclick = () => sendDecision(req._id, "rejected");
    btnRow.appendChild(approveBtn);
    btnRow.appendChild(rejectBtn);
    wrapper.appendChild(btnRow);
  }

  return wrapper;
}

async function loadRequests() {
  const list = document.getElementById("list");
  list.innerHTML = "Loading...";
  try {
    const items = await api("/api/requests");
    list.innerHTML = "";
    if (!items.length) {
      list.textContent = "No video requests yet.";
      return;
    }
    items.forEach((item) => list.appendChild(renderRequest(item)));
  } catch (error) {
    list.textContent = error.message;
  }
}

// --- Blogs ---
async function createBlogRequest() {
  const topic = document.getElementById("blogTopic").value.trim();
  const language = document.getElementById("blogLanguage").value;
  const msg = document.getElementById("blogCreateMsg");
  msg.textContent = "";

  if (!topic) {
    msg.textContent = "Topic is required";
    return;
  }

  try {
    const result = await api("/api/blog-requests", {
      method: "POST",
      body: JSON.stringify({ topic, language, source: "ui" })
    });
    msg.textContent = result.webhookWarning
      ? `Saved, but n8n: ${result.webhookWarning}`
      : "Blog request submitted and n8n triggered.";
    document.getElementById("blogTopic").value = "";
    await loadBlogRequests();
  } catch (error) {
    msg.textContent = error.message;
  }
}

async function sendBlogDecision(id, decision) {
  const notes = prompt("Optional notes for reviewer:", "") || "";
  const result = await api(`/api/blog-reviews/${id}`, {
    method: "POST",
    body: JSON.stringify({ decision, notes })
  });
  if (result.webhookWarning) {
    alert(`Review saved with warning: ${result.webhookWarning}`);
  }
  await loadBlogRequests();
}

function renderBlogRequest(req) {
  const wrapper = document.createElement("div");
  wrapper.className = "request blog-preview";
  const previewBlock =
    req.imageUrl || req.title || req.postText
      ? `
    ${req.imageUrl ? `<img src="${escapeHtml(req.imageUrl)}" alt="Blog image" />` : ""}
    ${req.title ? `<div><strong>Title:</strong> ${escapeHtml(req.title)}</div>` : ""}
    ${req.excerpt ? `<p class="excerpt">${escapeHtml(req.excerpt)}</p>` : ""}
    ${req.postText ? `<details><summary>Social post preview</summary><pre style="white-space:pre-wrap;font-size:12px;">${escapeHtml(req.postText)}</pre></details>` : ""}
  `
      : "<div>No preview yet</div>";

  wrapper.innerHTML = `
    <div><strong>Topic:</strong> ${escapeHtml(req.topic)}</div>
    <div><strong>Language:</strong> ${escapeHtml(req.language)}</div>
    <div><strong>Status:</strong> <span class="status">${escapeHtml(req.status)}</span></div>
    ${previewBlock}
  `;

  if (req.status === "pending_review") {
    const btnRow = document.createElement("div");
    btnRow.className = "row";
    const approveBtn = document.createElement("button");
    approveBtn.textContent = "Approve";
    approveBtn.onclick = () => sendBlogDecision(req._id, "approved");
    const rejectBtn = document.createElement("button");
    rejectBtn.className = "danger";
    rejectBtn.textContent = "Reject";
    rejectBtn.onclick = () => sendBlogDecision(req._id, "rejected");
    btnRow.appendChild(approveBtn);
    btnRow.appendChild(rejectBtn);
    wrapper.appendChild(btnRow);
  }

  return wrapper;
}

async function loadBlogRequests() {
  const list = document.getElementById("blogList");
  list.innerHTML = "Loading...";
  try {
    const items = await api("/api/blog-requests");
    list.innerHTML = "";
    if (!items.length) {
      list.textContent = "No blog requests yet.";
      return;
    }
    items.forEach((item) => list.appendChild(renderBlogRequest(item)));
  } catch (error) {
    list.textContent = error.message;
  }
}

document.getElementById("submitBtn").addEventListener("click", createRequest);
document.getElementById("refreshBtn").addEventListener("click", loadRequests);
document.getElementById("blogSubmitBtn").addEventListener("click", createBlogRequest);
document.getElementById("blogRefreshBtn").addEventListener("click", loadBlogRequests);

loadRequests();
