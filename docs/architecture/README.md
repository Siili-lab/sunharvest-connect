# Architecture Documentation

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTS                                │
│  ┌─────────────────┐         ┌─────────────────────────┐   │
│  │  Mobile App     │         │  SMS/USSD               │   │
│  │  (React Native) │         │  (Feature Phones)       │   │
│  └────────┬────────┘         └───────────┬─────────────┘   │
└───────────┼──────────────────────────────┼─────────────────┘
            │                              │
            ▼                              ▼
┌───────────────────────────────────────────────────────────┐
│                    API GATEWAY                             │
│                 (Authentication, Rate Limiting)            │
└─────────────────────────┬─────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Produce    │  │   Market     │  │    SMS       │
│   Service    │  │   Service    │  │   Service    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         ▼
              ┌─────────────────────┐
              │     Data Layer      │
              │  PostgreSQL + Redis │
              └─────────────────────┘
```

## Component Diagrams

See individual component documentation:
- [Mobile Architecture](./mobile-architecture.md)
- [Backend Architecture](./backend-architecture.md)
- [ML Pipeline](./ml-pipeline.md)
- [Data Flow](./data-flow.md)
