# SecureScanner Architecture and Improvement Roadmap

## 1) Current Architecture

### Frontend
- Stack: React + Vite.
- Main user flows:
  - Authentication (login/register/verify/reset).
  - SAST scan (file upload or Git repo URL).
  - DAST scan (URL-based scan).
  - Dashboard, report viewer, and admin panel.
- API usage:
  - Most pages use `VITE_API_URL`.
  - Some calls still use hardcoded `http://127.0.0.1:8000`.

### Backend
- Stack: FastAPI + MongoDB (Motor async client).
- Main modules:
  - Routes: auth, scan, history, admin, payments.
  - Controllers: orchestrate scan flow.
  - Services:
    - SAST: Bandit (Python) + Semgrep (multi-language).
    - DAST: crawler + forms testing + security header checks.
    - AI enrichment for findings.
    - Git scan, payments, report generation, token/auth services.
- Persistence:
  - Users, scans, subscriptions, monthly usage, verification tokens, reset tokens.

## 2) AI/ML Model Usage

The project uses local serialized ML models loaded from disk (pickle/joblib), not a hosted LLM API.

### Models loaded in runtime
- `vulnerability_model.pkl` + `vectorizer.pkl`
  - Purpose: confidence score for finding validity.
- `msr_vulnerability_model.pkl`
  - Purpose: vulnerability type classification.
- `risk_model.pkl` + `risk_vectorizer.pkl`
  - Purpose: risk level prediction.
- `severity_model.pkl`
  - Purpose: severity prediction.

### Output enrichment
Each vulnerability may receive:
- `confidence`
- `ai_verdict` (`Confirmed`, `Likely`, `Review`)
- `ai_vuln_type`
- `risk_level`
- `ai_severity`

### Training status
- Inference is present in code.
- Training pipeline scripts are not present in this repository.

## 3) Key Risks and Gaps Identified

1. Payment service consistency risk:
   - Missing/undefined references are likely (`PRICE_IDS`, missing imports for `ObjectId` and DB usage context).
2. Env loading order:
   - `load_dotenv()` currently called after some `os.getenv` reads in config, which can produce empty values.
3. DAST transport security:
   - Uses `verify=False` for requests, unsafe for production by default.
4. Frontend API base inconsistency:
   - Hardcoded API URL in some pages instead of centralized environment config.
5. Scan execution model:
   - Long scans run inside request lifecycle; no async queue/job tracking yet.

## 4) Enhancement Plan (Phased)

## Phase 1 (Stability and Security, 1 week)
- Fix config loading order (`load_dotenv()` first).
- Normalize backend env usage and add startup validation for required keys.
- Standardize frontend API base URL in one helper module.
- Harden DAST URL validation to block localhost/private network scanning by default.
- Keep TLS verify enabled by default; add explicit opt-in debug mode for insecure requests.

## Phase 2 (Reliability and Scale, 1-2 weeks)
- Introduce background job queue for scans (Redis + Celery/RQ).
- Return job IDs from scan endpoints; add polling/status endpoint.
- Add scan cancellation and timeout controls.
- Add structured logging and error codes for scanner failures.

## Phase 3 (Detection Quality, 2-3 weeks)
- Add dependency vulnerability scan (SCA for npm/pip).
- Add secret scanning.
- Expand DAST checks (auth session handling, custom headers/cookies, crawler depth).
- Add finding deduplication and normalized taxonomy (OWASP/CWE mapping).

## Phase 4 (Product Features, 2 weeks)
- Scan diff view (new/fixed/regressed vulnerabilities).
- CI integration (GitHub Actions/GitLab) with severity threshold gates.
- Team workflow (assignee, status, comments, remediation SLA).
- Notification system (email/slack/webhook on scan completion or critical findings).

## Phase 5 (ML Ops and Intelligence, 2+ weeks)
- Add model metadata registry (version, trained_at, dataset hash).
- Add confidence calibration and model quality metrics.
- Add retraining/evaluation scripts in-repo with reproducible pipeline.
- Add explainability fields for predictions and low-confidence fallback signaling.

## 5) Suggested Next 3 Implementation Tasks

1. Create a shared frontend API client and replace hardcoded API URLs.
2. Fix backend configuration and payment service integrity issues.
3. Add secure DAST URL guardrails and default TLS verification.

## 6) Future Features You Can Add

- SSO (Google/GitHub/SAML) for enterprise users.
- SBOM generation and compliance export.
- Multi-tenant organizations and role hierarchy.
- Vulnerability suppression/false-positive workflow.
- Trend analytics dashboard with MTTR and risk burn-down.
