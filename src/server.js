const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const requestSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true, trim: true },
    language: { type: String, required: true, default: "en" },
    voiceId: { type: String, default: "" },
    avatarId: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "queued",
        "generating",
        "pending_review",
        "approved",
        "rejected",
        "published",
        "failed"
      ],
      default: "queued"
    },
    previewUrl: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    reviewerNotes: { type: String, default: "" },
    source: { type: String, default: "" },
    script: { type: String, default: "" },
  },
  { timestamps: true }
);

const VideoRequest = mongoose.model("VideoRequest", requestSchema);

const blogRequestSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true, trim: true },
    keyword: { type: String, default: "" },
    hook: { type: String, default: "" },
    language: { type: String, required: true, default: "en" },
    status: {
      type: String,
      enum: [
        "queued",
        "generating",
        "pending_review",
        "approved",
        "rejected",
        "published",
        "failed"
      ],
      default: "queued"
    },
    reviewerNotes: { type: String, default: "" },
    source: { type: String, default: "" },
    postText: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    imagePrompt: { type: String, default: "" },
    title: { type: String, default: "" },
    slug: { type: String, default: "" },
    content: { type: String, default: "" },
    excerpt: { type: String, default: "" },
    summary: { type: String, default: "" },
    category: { type: String, default: "" },
    tags: { type: [String], default: [] },
    keyPoints: { type: [String], default: [] },
    faqSection: { type: mongoose.Schema.Types.Mixed, default: [] },
    focusKeyword: { type: String, default: "" },
    semanticKeywords: { type: [String], default: [] },
    searchIntent: { type: String, default: "informational" },
    contentType: { type: String, default: "guide" },
    difficulty: { type: String, default: "beginner" },
    targetAudience: { type: [String], default: [] },
    readTime: { type: Number, default: 0 },
    websiteUrl: { type: String, default: "" },
    websitePostId: { type: String, default: "" }
  },
  { timestamps: true }
);

const BlogRequest = mongoose.model("BlogRequest", blogRequestSchema);

function normalizeBlogSource(source) {
  return String(source || "ui").toLowerCase() === "airtable" ? "airtable" : "ui";
}

const HEYGEN_BASE = "https://api.heygen.com";

async function heygenGet(endpoint) {
  const res = await fetch(`${HEYGEN_BASE}${endpoint}`, {
    method: "GET",
    headers: {
      "X-Api-Key": process.env.HEYGEN_API_KEY || "",
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HeyGen ${res.status}: ${errText}`);
  }
  return res.json();
}

async function callN8nWebhook(url, payload) {
  if (!url) return;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`n8n webhook failed (${response.status}): ${body}`);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/meta/voices", async (_req, res) => {
  try {
    const data = await heygenGet("/v2/voices");
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/meta/avatars", async (_req, res) => {
  try {
    const data = await heygenGet("/v2/avatars");
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/requests", async (req, res) => {
  try {
    const { topic, language, voiceId, avatarId, source } = req.body;
    if (!topic) {
      return res.status(400).json({
        message: "topic is required"
      });
    }

    const doc = await VideoRequest.create({
      topic,
      language: language || "en",
      voiceId: typeof voiceId === "string" ? voiceId : "",
      avatarId: typeof avatarId === "string" ? avatarId : "",
      source: typeof source === "string" ? source : ""
    });

    let webhookWarning = null;
    if (source === "ui") {
      try {
        await callN8nWebhook(process.env.N8N_START_WEBHOOK_URL, {
          requestId: doc._id.toString(),
          topic: doc.topic,
          language: doc.language,
          ...(doc.voiceId ? { voiceId: doc.voiceId } : {}),
          ...(doc.avatarId ? { avatarId: doc.avatarId } : {}),
          source: "ui"
        });
      } catch (error) {
        webhookWarning = error.message;
      }
    }

    res.status(201).json({ ...doc.toObject(), webhookWarning });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/requests", async (req, res) => {
  try {
    const status = req.query.status;
    const query = status ? { status } : {};
    const docs = await VideoRequest.find(query).sort({ createdAt: -1 }).limit(100);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/requests/:id", async (req, res) => {
  try {
    const doc = await VideoRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch("/api/requests/:id", async (req, res) => {
  try {
    const updates = req.body;
    const doc = await VideoRequest.findByIdAndUpdate(req.params.id, updates, {
      new: true
    });
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/blog-requests", async (req, res) => {
  try {
    const { topic, language, keyword, hook, source } = req.body;
    if (!topic) {
      return res.status(400).json({ message: "topic is required" });
    }

    const doc = await BlogRequest.create({
      topic,
      language: language || "en",
      keyword: typeof keyword === "string" ? keyword : "",
      hook: typeof hook === "string" ? hook : "",
      source: typeof source === "string" ? source : ""
    });

    let webhookWarning = null;
    if (normalizeBlogSource(source) === "ui") {
      try {
        await callN8nWebhook(process.env.N8N_BLOG_START_WEBHOOK_URL, {
          requestId: doc._id.toString(),
          topic: doc.topic,
          language: doc.language,
          keyword: doc.keyword,
          hook: doc.hook,
          source: "ui"
        });
      } catch (error) {
        webhookWarning = error.message;
      }
    }

    res.status(201).json({ ...doc.toObject(), webhookWarning });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/blog-requests", async (req, res) => {
  try {
    const status = req.query.status;
    const query = status ? { status } : {};
    const docs = await BlogRequest.find(query).sort({ createdAt: -1 }).limit(100);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/blog-requests/:id", async (req, res) => {
  try {
    const doc = await BlogRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch("/api/blog-requests/:id", async (req, res) => {
  try {
    const doc = await BlogRequest.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    });
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/blog-reviews/:id", async (req, res) => {
  try {
    const { decision, notes = "" } = req.body;
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "decision must be approved or rejected" });
    }

    const isReject = decision === "rejected";
    const updates = {
      reviewerNotes: notes,
      status: isReject ? "generating" : "approved",
      ...(isReject
        ? {
            postText: "",
            imageUrl: "",
            title: "",
            excerpt: "",
            slug: "",
            content: ""
          }
        : {})
    };

    const doc = await BlogRequest.findByIdAndUpdate(req.params.id, updates, {
      new: true
    });
    if (!doc) return res.status(404).json({ message: "Not found" });

    let webhookWarning = null;
    try {
      if (isReject) {
        const regenUrl = process.env.N8N_BLOG_REGEN_WEBHOOK_URL;
        if (!regenUrl) {
          webhookWarning = "N8N_BLOG_REGEN_WEBHOOK_URL is not configured";
        } else {
          await callN8nWebhook(regenUrl, {
            requestId: doc._id.toString(),
            topic: doc.topic,
            language: doc.language,
            keyword: doc.keyword,
            hook: doc.hook,
            source: normalizeBlogSource(doc.source),
            regenerate: true
          });
        }
      } else {
        await callN8nWebhook(process.env.N8N_BLOG_REVIEW_WEBHOOK_URL, {
          requestId: doc._id.toString(),
          decision: "approved",
          notes
        });
      }
    } catch (error) {
      webhookWarning = error.message;
    }

    res.json({ ...doc.toObject(), webhookWarning });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/reviews/:id", async (req, res) => {
  try {
    const { decision, notes = "" } = req.body;
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "decision must be approved or rejected" });
    }

    const isReject = decision === "rejected";
    const updates = {
      reviewerNotes: notes,
      status: isReject ? "generating" : "approved",
      ...(isReject ? { previewUrl: "", thumbnailUrl: "" } : {})
    };

    const doc = await VideoRequest.findByIdAndUpdate(req.params.id, updates, {
      new: true
    });
    if (!doc) return res.status(404).json({ message: "Not found" });

    let webhookWarning = null;
    try {
      if (isReject) {
        const regenUrl = process.env.N8N_REGEN_WEBHOOK_URL;
        if (!regenUrl) {
          webhookWarning = "N8N_REGEN_WEBHOOK_URL is not configured";
        } else {
          await callN8nWebhook(regenUrl, {
            requestId: doc._id.toString(),
            topic: doc.topic,
            language: doc.language,
            voiceId: doc.voiceId || "",
            avatarId: doc.avatarId || "",
            source:
              String(doc.source || "ui").toLowerCase() === "airtable"
                ? "airtable"
                : "ui",
            regenerate: true
          });
        }
      } else {
        await callN8nWebhook(process.env.N8N_REVIEW_WEBHOOK_URL, {
          requestId: doc._id.toString(),
          decision: "approved",
          notes
        });
      }
    } catch (error) {
      webhookWarning = error.message;
    }

    res.json({ ...doc.toObject(), webhookWarning });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

async function start() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI is missing");
  await mongoose.connect(mongoUri);
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
