

# CareStance Dashboard

Dashboard system for CareStance, containing role-based interfaces for **Parents, Teachers, and School Administrators**.

## Project Structure

```text
Dashboard/
│
├── frontend/
│   │
│   ├── parents/
│   │   └── Parent dashboard pages and components
│   │
│   ├── teachers/
│   │   ├── Assessments.html
│   │   ├── Career_insights.html
│   │   ├── Classes.html
│   │   ├── dashboard.html
│   │   ├── messages.html
│   │   ├── Reports.html
│   │   ├── settings.html
│   │   ├── Students.html
│   │   └── tasks_events.html
│   │
│   ├── school_admin/
│   │   └── School administrator dashboard pages and components
│   │
│   ├── shared_assets/
│   │   ├── logo.png
│   │   ├── p1.png
│   │   ├── p2.png
│   │   ├── t1.png
│   │   ├── t2.png
│   │   └── ts.mp4
│   │
│   └── login.html
│
├── backend/
│   └── Backend services and APIs
│
└── README.md
```

## Dashboard Roles

### Parent Dashboard

Contains the interface and features intended for parents to monitor and interact with their child's academic information.

### Teacher Dashboard

Contains teacher-focused features including:

* Dashboard
* Assessments
* Classes
* Students
* Career Insights
* Messages
* Reports
* Tasks & Events
* Settings

### School Admin Dashboard

Contains administrative interfaces for managing and monitoring school-level information and activities.

## Shared Assets

The `shared_assets/` folder contains assets that are reused across multiple dashboards, including:

* Logos
* Images
* Videos
* Common visual resources

Role-specific assets should remain within their respective dashboard folders where possible.

## Backend

The `backend/` folder is reserved for:

* Backend services
* APIs
* Database-related functionality
* Authentication and authorization
* Integration logic

## Development Guidelines

* Keep **frontend** and **backend** code separated.
* Keep Parent, Teacher, and School Admin work inside their respective folders.
* Place reusable assets in `shared_assets/`.
* Avoid duplicating shared assets across dashboard folders.
* Work on a separate Git branch for individual changes.
* Create a Pull Request before merging changes into `main`.

## Branch Workflow

```text
main
 │
 ├── feature/parent-dashboard
 │
 ├── feature/teacher-dashboard
 │
 ├── feature/school-admin-dashboard
 │
 └── feature/backend
          │
          ↓
       Pull Request
          │
          ↓
        Review
          │
          ↓
       main
```

## Current Repository

The repository is being developed as a centralized dashboard system for the CareStance platform, with separate role-based interfaces and a shared backend.
