# AI Video Ops Portal

Minimal starter for:
- Client UI (topic, language, voice, avatar)
- MongoDB state storage
- n8n webhook trigger for generation
- Client approve/reject callback to n8n

## 1) Setup

1. Copy `.env.example` to `.env`
2. Fill:
   - `MONGODB_URI`
   - `HEYGEN_API_KEY`
   - `N8N_START_WEBHOOK_URL`
   - `N8N_REVIEW_WEBHOOK_URL`
3. Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 2) Data model

Single collection: `videorequests`

Status flow:
- `queued`
- `generating`
- `pending_review`
- `approved` / `rejected`
- `published` / `failed`

## 3) API endpoints

- `GET /api/health`
- `GET /api/meta/voices` (HeyGen proxy)
- `GET /api/meta/avatars` (HeyGen proxy)
- `POST /api/requests`  
  Creates request and calls `N8N_START_WEBHOOK_URL`
- `GET /api/requests?status=...`
- `PATCH /api/requests/:id`  
  (used by n8n to update status/preview/final URL)
- `POST /api/reviews/:id`  
  Saves decision and calls `N8N_REVIEW_WEBHOOK_URL`

## 4) n8n wiring

## Workflow A: Start video generation

Trigger: Webhook (URL = `N8N_START_WEBHOOK_URL`)

Input payload:

```json
{
  "requestId": "mongo_id",
  "topic": "....",
  "language": "en",
  "voiceId": "....",
  "avatarId": "...."
}
```

Flow:
1. `PATCH /api/requests/:id` -> `status=generating`
2. Run existing generation pipeline
3. Upload/obtain preview URL
4. `PATCH /api/requests/:id` -> `status=pending_review`, `previewUrl=...`

## Workflow B: Review decision

Trigger: Webhook (URL = `N8N_REVIEW_WEBHOOK_URL`)

Input payload:

```json
{
  "requestId": "mongo_id",
  "decision": "approved|rejected",
  "notes": ""
}
```

Branch:
- if approved:
  - Publish to website API
  - `PATCH /api/requests/:id` -> `status=published`, `finalUrl=...`
- if rejected:
  - `PATCH /api/requests/:id` -> `status=rejected`

## 5) Production notes

- Protect API with auth before client handover.
- Put rate limiting on endpoints.
- Add audit logs for reviewer actions.
- Use HTTPS and secure secret management.
