# Deployment Guide — Vercel (frontend) + Render (backend)

This project is a split deployment:

- **Frontend:** React + Vite → **Vercel**
- **Backend:** FastAPI + MongoDB Atlas → **Render**
- **Database:** MongoDB Atlas (external)
- **Email:** SMTP (Gmail app password or another provider)

```
Browser
  │
  ├── https://your-app.vercel.app   (Vercel: frontend/dist)
  │        │
  │        └── fetch VITE_API_BASE_URL + /api/*
  │
  └── https://your-api.onrender.com (Render: uvicorn backend.main:app)
           │
           └── MongoDB Atlas + SMTP
```

---

## 1. Prerequisites

- GitHub repository containing this project.
- [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.
- [Render](https://render.com) account.
- [Vercel](https://vercel.com) account.
- SMTP credentials (Gmail App Password recommended).

> **Important:** Never commit `.env` files. They are gitignored. Use the
> platform environment-variable settings instead.

---

## 2. MongoDB Atlas setup

1. Create a cluster and database user.
2. Get the connection string:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
   ```
3. Go to **Network Access** and add:
   ```
   0.0.0.0/0
   ```
   (or restrict it to Render egress IPs if you have a paid static-IP setup).
4. The app uses `DATABASE_NAME=attendance-monitoring-system` by default.
   Collections and default settings are created automatically on first start.

> The backend now fails fast in production if Atlas is unreachable. It will
> **not** silently switch to an in-memory database. This prevents “my data
> disappeared after restart” issues on Render.

---

## 3. Deploy the backend on Render

### Option A — Blueprint (recommended)

1. Push the repo to GitHub.
2. In Render, choose **New → Blueprint**.
3. Select the repository. Render reads `render.yaml`.
4. Fill in the `sync: false` environment variables when prompted:
   - `MONGODB_URI`
   - `SMTP_USERNAME`
   - `SMTP_PASSWORD`
   - `MAIL_FROM`
   - `ADMIN_EMAIL`
   - `CORS_ORIGINS` (your Vercel URL, e.g. `https://your-app.vercel.app`)
5. Deploy.

### Option B — Manual Web Service

| Setting | Value |
|---|---|
| Environment | Python 3 |
| Root Directory | *(leave empty / repo root)* |
| Build Command | `bash build.sh` |
| Start Command | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |

Set these environment variables in **Environment**:

| Key | Required | Example / notes |
|---|---|---|
| `PYTHON_VERSION` | yes | `3.11.11` |
| `ENVIRONMENT` | yes | `production` |
| `MONGODB_URI` | yes | `mongodb+srv://...` |
| `DATABASE_NAME` | yes | `attendance-monitoring-system` |
| `SMTP_HOST` | yes | `smtp.gmail.com` |
| `SMTP_PORT` | yes | `587` |
| `SMTP_USERNAME` | yes | your email |
| `SMTP_PASSWORD` | yes | app password (not your normal password) |
| `MAIL_FROM` | yes | sender email |
| `ADMIN_EMAIL` | yes | admin notification email |
| `ATTENDANCE_CUTOFF` | no | `11:40` |
| `CORS_ORIGINS` | yes | `https://your-app.vercel.app` |
| `CORS_ORIGIN_REGEX` | no | `https://.*\.vercel\.app` |
| `FRONTEND_URL` | no | alternative to adding one origin in `CORS_ORIGINS` |

Do **not** set `PORT`; Render provides it automatically.

### Provision the initial admin and manager accounts

User credentials are not configured in Render environment variables or
hardcoded in the application. To create/update the requested admin and manager
records directly in MongoDB, run `python -m backend.seed_accounts` from the
repository root in an environment with the production `MONGODB_URI` and
`DATABASE_NAME` configured. The script prompts for each password without
displaying it and stores only a salted password hash in the `users` collection.
It updates matching accounts by email; it stops on conflicting account IDs.

The login screen's quick-sign-in buttons only fill the email address. Users
still enter their password; passwordless auto-login remains disabled.

The application uses `Asia/Kolkata` for attendance dates, timestamps, logs,
and display. No timezone environment variable is needed. Application audit
timestamps are stored as ISO-8601 strings with an explicit `+05:30` offset so
they display as Indian Standard Time in MongoDB tools. Existing BSON date
values in supported timestamp fields are converted to this format on startup.
MongoDB `Date` values themselves are always UTC instants and cannot be stored
with a physical timezone.

### Why `build.sh`?

`face-recognition` normally pulls the `dlib` source package, which can fail or
take a long time on Render. `build.sh`:

1. Installs `dlib-bin` (pre-built Linux wheel).
2. Installs `face-recognition` with `--no-deps`.
3. Verifies `cv2`, `dlib`, and `face_recognition` import successfully.

If the build fails, the logs will show which step failed.

### Verify the backend

Open:

- `https://your-api.onrender.com/health`
- `https://your-api.onrender.com/docs`
- `https://your-api.onrender.com/api/admin/settings`

Expected health response:

```json
{
  "status": "running",
  "database_connected": true
}
```

---

## 4. Deploy the frontend on Vercel

1. In Vercel, choose **Add New → Project** and import the same repository.
2. Configure the project:

   **Option A — repo root (recommended, uses root `vercel.json`)**
   - Root Directory: *(leave empty)*
   - Framework Preset: Other (the commands below build the `frontend/` app)
   - Build Command: `npm --prefix frontend run build`
   - Output Directory: `frontend/dist`
   - Install Command: `npm --prefix frontend ci`

   **Option B — frontend root**
   - Root Directory: `frontend`
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm ci`

3. Add an environment variable:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://your-api.onrender.com` |

   - Do **not** append `/api`.
   - Add it for **Production**, **Preview**, and **Development** if you want all
     deployments to use the same backend.
   - Vite embeds this value at **build time**, so redeploy after changing it.

4. Deploy.

Vercel serves the HTML entry point without caching so a deployment cannot keep
referencing old, hashed JavaScript bundles. Hashed files under `/assets/` are
cached as immutable. If the app reports a module-script MIME error immediately
after deployment, redeploy the frontend and do a hard refresh once to clear any
HTML already cached by the browser.

### Vercel environment variables

You can also add the optional office fallback variables from
`frontend/.env.example`:

```
VITE_OFFICE_NAME=Head Office Block
VITE_OFFICE_LAT=11.27037707675975
VITE_OFFICE_LNG=77.60352284059195
VITE_OFFICE_RADIUS_METERS=1000
VITE_OFFICE_GEOFENCE_POLYGON=...
```

The live values in MongoDB / Admin Settings override these at runtime.

The office geofence radius can be configured in **Admin Settings → Office
Location**, from 20 m up to **100,000 m (100 km)**. Set the smallest radius
that reliably covers the workplace; larger radii allow attendance marking
farther from the configured coordinates.

---

## 5. CORS checklist

The backend accepts:

- `CORS_ORIGINS` — comma-separated exact origins.
- `CORS_ORIGIN_REGEX` — defaults to `https://.*\.vercel\.app`.
- `FRONTEND_URL` — optional convenience origin.

For a custom domain (for example `https://attendance.yourcompany.com`), add it
to `CORS_ORIGINS` on Render:

```
CORS_ORIGINS=https://your-app.vercel.app,https://attendance.yourcompany.com
```

If you see a browser CORS error, confirm:

1. The Vercel URL exactly matches an allowed origin (scheme + host, no trailing slash).
2. `VITE_API_BASE_URL` points to the Render URL.
3. Render was redeployed after changing CORS variables.

---

## 6. Local development

### Backend

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate

pip install -r requirements.txt
pip install "face-recognition==1.3.0" --no-deps

uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

Local API calls use the Vite proxy (`/api` → `http://127.0.0.1:8000`), so
`VITE_API_BASE_URL` can stay empty in `frontend/.env`.

Or use the Windows launcher:

```bat
run_app.bat
```

---

## 7. Common issues

### `database_connected: false` / backend crashes on Render

- Check `MONGODB_URI` and `DATABASE_NAME`.
- Check Atlas **Network Access**.
- Check the Render logs for `MongoDB Atlas connection failed`.
- `ENVIRONMENT=production` intentionally disables the in-memory fallback.

### Frontend gets 404 for `/api/...`

- `VITE_API_BASE_URL` is missing or wrong in Vercel.
- Redeploy Vercel after adding/changing the variable.
- Confirm the value is the backend **origin**, not a path.

### CORS error

- Add the exact Vercel URL to `CORS_ORIGINS` on Render.
- Redeploy the Render service after changing env vars.
- Vercel preview URLs are covered by `CORS_ORIGIN_REGEX`.

### Face detection / registration fails

- Check Render build logs for `Face stack OK`.
- Confirm the `models/` folder was pushed to GitHub.
- `dlib-bin` requires Python 3.11 on Render; keep `.python-version` and
  `PYTHON_VERSION` aligned.

### Render free tier is slow on first request

Free instances sleep. The first request can take 30–60 seconds. Upgrade the
Render plan or use a keep-alive ping if this is a problem.

### Face recognition runs out of memory on Render

The free 512 MB instance can be tight when OpenCV + dlib + the landmark models
are all loaded. If the service restarts during registration/attendance,
upgrade to a larger Render instance. The rest of the API works on the free
tier.

### Camera does not work

Browsers require **HTTPS** (or localhost) for `getUserMedia`. Vercel provides
HTTPS automatically.

### Email / OTP does not arrive

- Verify `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM`, and `ADMIN_EMAIL`.
- Gmail requires an **App Password**, not the account password.
- Some hosts restrict outbound SMTP. If port `587` times out, try your
  provider's SSL port (`465`) or a transactional email service.
- After fixing the SMTP settings and redeploying, retry queued or failed
  notifications with `POST https://<backend-url>/attendance/process-emails?retry_failed=true`.
  The response reports `attempted`, `sent`, and `failed` counts. A nonzero
  `failed` count means the Render service logs contain the SMTP delivery error.
- Absence emails go to the employee's registered email, their assigned
  manager (if set), and active admin accounts. `ADMIN_EMAIL` is only used as
  a fallback when there are no active admin accounts.

---

## 8. Files added/changed for deployment

| File | Purpose |
|---|---|
| `render.yaml` | Render Blueprint (Python version, build, start, health check, env vars) |
| `build.sh` | Installs dependencies + pre-built dlib + verifies face stack |
| `.python-version` | Pins Python 3.11.11 on Render |
| `.nvmrc` / `frontend/.nvmrc` | Pins Node 22 for Vercel |
| `vercel.json` | Vercel build/output/SPA rewrite when deploying from repo root |
| `frontend/vercel.json` | Vercel config when Root Directory is `frontend` |
| `.vercelignore` | Keeps backend/models out of the frontend upload |
| `frontend/src/services/apiConfig.ts` | Central `VITE_API_BASE_URL` handling |
| `frontend/.env.example` | Frontend environment template |
| `.env.example` | Backend environment template |
| `.gitattributes` | Keeps shell/YAML files LF for Render |
