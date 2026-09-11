# Second Pair

A second pair of eyes on your deployment, before it ships. Paste a deployment
plan, manifest, or release notes and Second Pair returns a structured pre-deploy
review — a verdict, four scores, issues, a checklist, and strengths — generated
by an Amazon Nova model on Amazon Bedrock.

Second Pair is a full-stack AWS Amplify Gen 2 application: a React + TypeScript +
Vite frontend and a TypeScript backend, deployed together through Amplify's
Git-based workflow.

## Architecture

```
Browser (React SPA)
   │  POST /review  { content }
   ▼
AWS Amplify Hosting  ──────────────  serves the built SPA
   │
   ▼
API Gateway HTTP API  (CORS enabled, route: POST /review)
   │
   ▼
Amplify Function / AWS Lambda  (second-pair-review)
   │  Bedrock Converse API
   ▼
Amazon Bedrock  →  Amazon Nova model
```

- **Frontend** — React SPA built with Vite, hosted on **Amplify Hosting**. It
  reads the deployed API endpoint from Amplify outputs at runtime (no hard-coded
  production URL).
- **API** — an **API Gateway HTTP API** with a single route, `POST /review`, and
  CORS configured so the hosted frontend can call it from the browser.
- **Function** — an **Amplify Gen 2 Function** (Node.js Lambda) running the
  review handler. It validates input, calls Amazon Nova through the Bedrock
  **Converse API**, validates the model's structured JSON output, and returns it.
- **Model** — an **Amazon Nova** model on **Amazon Bedrock**. The function's IAM
  role is granted `bedrock:InvokeModel` scoped to only the configured model.

No database, authentication, user accounts, or review history — submitted content
is processed in memory and never persisted or logged.

### Request flow and status codes

| Condition                                            | Response |
| ---------------------------------------------------- | -------- |
| Valid `content` (50–20,000 chars), review succeeds   | `200`    |
| Missing/invalid body or `content` out of bounds      | `400`    |
| Bedrock call fails or model output fails validation  | `502`    |
| Unexpected internal error                            | `500`    |

Error responses use a fixed `{ "error": { "code", "message" } }` envelope with
safe, client-facing text. Internal error details and AWS metadata are never
returned to the client.

## Project structure

```
second-pair/
├── amplify/
│   ├── backend.ts                 # defineBackend + HTTP API + CORS + Bedrock IAM + outputs
│   ├── tsconfig.json
│   └── functions/
│       └── review/
│           ├── resource.ts        # defineFunction + configurable Nova model id
│           ├── handler.ts         # Amplify entry point (re-exports lib handler)
│           └── lib/               # review logic (validation, prompt, schema, Bedrock)
│               ├── reviewHandler.ts
│               ├── validation.ts
│               ├── prompt.ts
│               ├── schema.ts
│               ├── bedrock.ts
│               ├── http.ts
│               └── types.ts
├── src/                           # React + Vite frontend
│   ├── config.ts                  # resolves the API URL from Amplify outputs
│   ├── mockReview.ts              # calls the API, or mock data when unconfigured
│   └── ...
├── amplify.yml                    # Amplify Hosting build spec (backend + frontend)
├── vite.config.ts
└── package.json
```

The review logic under `amplify/functions/review/lib/` is the original backend,
moved verbatim — its behavior is unchanged.

## Prerequisites

- Node.js `^18.19.0 || ^20.6.0 || >=22` and npm
- An AWS account with **Amazon Bedrock model access enabled** for the Nova model
  you intend to use, in your deployment region
  (Bedrock console → *Model access*)
- AWS credentials configured locally (`aws sts get-caller-identity` succeeds) for
  sandbox development

## Local development

Install dependencies:

```bash
npm install
```

### Frontend only (mock data)

```bash
npm run dev
```

With no backend configured, the app falls back to built-in **mock review data**,
so the UI is fully usable without deploying anything.

### Full stack (personal cloud sandbox)

Provision a personal backend in your AWS account. This deploys the Function, HTTP
API, and IAM, and generates `amplify_outputs.json` locally:

```bash
npx ampx sandbox        # watches for changes; or `--once` for a single deploy
```

In a second terminal, run the frontend. Once `amplify_outputs.json` exists, the
app automatically calls the real `POST /review` endpoint instead of the mock:

```bash
npm run dev
```

> `amplify_outputs.json` is generated and **gitignored** — it is never committed.

## Configuring the Nova model

The model id is configurable and defaults to `amazon.nova-lite-v1:0`. Override it
with the `BEDROCK_MODEL_ID` environment variable at deploy time. The same value
scopes the function's Bedrock IAM permission, so no code change is needed to
switch models.

- **Sandbox:** `BEDROCK_MODEL_ID=amazon.nova-pro-v1:0 npx ampx sandbox`
- **Hosting:** set `BEDROCK_MODEL_ID` in the Amplify console under
  *App settings → Environment variables*.

Both plain foundation-model ids (`amazon.nova-lite-v1:0`) and cross-region
inference-profile ids (`us.amazon.nova-lite-v1:0`) are supported; the IAM policy
adapts to authorize the matching ARN(s).

## Deployment (Amplify Git-based workflow)

Second Pair deploys through Amplify Hosting's fullstack CI/CD. Every push to a
connected branch builds the frontend and deploys the backend using the phases in
`amplify.yml`.

1. **Push this repo to Git** (GitHub, GitLab, Bitbucket, or CodeCommit).

2. **Create the Amplify app** and connect the branch — either in the Amplify
   console (*Host web app* → connect repository) or via CLI:

   ```bash
   REPO="github.com/<user>/second-pair"
   APP_ID=$(aws amplify create-app \
     --name second-pair \
     --repository "$REPO" \
     --access-token "$(gh auth token)" \
     --query 'app.appId' --output text)

   aws amplify create-branch --app-id "$APP_ID" --branch-name main
   ```

3. **Attach a backend deploy service role** (required for backend deployments):

   ```bash
   ROLE_NAME="AmplifyBackendRole-${APP_ID}"
   aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document '{
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": {"Service": "amplify.amazonaws.com"},
       "Action": "sts:AssumeRole"
     }]
   }'
   aws iam attach-role-policy --role-name "$ROLE_NAME" \
     --policy-arn arn:aws:iam::aws:policy/service-role/AmplifyBackendDeployFullAccess
   ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
   aws amplify update-app --app-id "$APP_ID" --iam-service-role-arn "$ROLE_ARN"
   ```

4. **Enable Bedrock model access** for the chosen Nova model in the deployment
   region (Bedrock console → *Model access*).

5. **(Optional) Set the model id:** add `BEDROCK_MODEL_ID` under the app's
   environment variables if you want something other than the default.

6. **Deploy** — push to the branch, or trigger a build:

   ```bash
   aws amplify start-job --app-id "$APP_ID" --branch-name main --job-type RELEASE
   ```

During the build, `npx ampx pipeline-deploy` provisions the backend and writes
`amplify_outputs.json`, which is then bundled into the frontend so the SPA knows
its API endpoint. The frontend is served from
`https://main.<app-id>.amplifyapp.com`.

### Build specification

`amplify.yml` runs the backend deploy first, then builds the Vite frontend
(output directory `dist`):

```yaml
version: 1
backend:
  phases:
    build:
      commands:
        - npm ci --cache .npm --prefer-offline
        - npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID
frontend:
  phases:
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
```

## How the frontend finds the API

`src/config.ts` resolves the endpoint in this order:

1. `VITE_REVIEW_API_URL` — an optional build-time override (handy for pointing a
   local frontend at a sandbox API).
2. `custom.reviewApiUrl` from `amplify_outputs.json` (set by `backend.addOutput`).
3. If neither is present, the app uses mock data.

This means the production URL is supplied by Amplify outputs rather than being
hard-coded.

## Security notes

- **Least-privilege IAM:** the function may call only `bedrock:InvokeModel`, and
  only for the configured model ARN(s).
- **No persistence:** submitted content is held in memory for the request only —
  never logged or stored.
- **Opaque errors:** internal failures and AWS metadata are never surfaced to the
  client.
- **CORS:** the HTTP API allows the hosted origin. It ships permissively
  (`*`) so the app works immediately; tighten `allowOrigins` in
  `amplify/backend.ts` to your `amplifyapp.com` origin for production.

## Notes on this conversion

- The application uses **AWS Amplify Gen 2** for both hosting and backend
  infrastructure. It does **not** use AWS SAM (none was present to remove).
- The original review handler logic was **moved, not rewritten** — its behavior
  is preserved exactly.
- API Gateway and the Bedrock IAM policy are defined with **CDK** inside
  `amplify/backend.ts`, as Amplify Gen 2 intends for resources it does not model
  natively.
