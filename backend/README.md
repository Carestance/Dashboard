# CareStance API — Teacher Dashboard foundation

The backend uses a central identity table for login and separate school/consumer profile datasets. Login queries only `users`; role and organization scope are embedded in the signed session token. Teacher endpoints enforce both `teacher` role and assigned-class membership, so a teacher cannot query another school's data.

## Run locally

```powershell
cd backend
Copy-Item .env.example .env
npm.cmd install
npm.cmd run seed
npm.cmd run dev
```

Demo teacher: `simran@carestance.demo` / `Teacher@123`

Open `http://localhost:3000/` to use the complete teacher sign-in and dashboard flow. The API serves the existing frontend files, so the dashboard and API run from the same origin.

## Implemented endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health check |
| `POST` | `/api/v1/auth/login` | Authenticate and return a JWT |
| `GET` | `/api/v1/auth/me` | Read current session identity |
| `GET` | `/api/v1/teacher/dashboard?classId=` | Teacher dashboard data for an assigned class |
| `GET` | `/api/v1/teacher/classes/:classId/students` | Live class roster and progress status |
| `GET` | `/api/v1/teacher/students/:studentId` | Academic/development-only individual student profile |
| `POST` | `/api/v1/teacher/students/:studentId/notes` | Create a teacher note for an assigned student |

Send `Authorization: Bearer <token>` to protected endpoints. Omitting `classId` selects the teacher's first assigned class.

## Dashboard response

The teacher dashboard returns summary metrics, performance-area percentages, a seven-day activity series, today's events, an actionable attention list, and only classes assigned to the authenticated teacher. The attention list is calculated from school-configurable rules for inactivity, incomplete assessments, roadmap progress, and missed weekly goals.

## Data separation

- `users` is the single authentication/role entry point.
- `school_students` holds school-only student fields and is organization-scoped.
- `consumer_profiles` holds normal/direct-customer data separately.
- `organization_id` plus class assignment checks isolate every teacher read.

Run `npm.cmd test` to reseed the local demo database and verify teacher authorization.
