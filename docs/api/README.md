# API Documentation

## Base URL

```
Development: http://localhost:3000/api/v1
Production:  https://api.sunharvest.co.ke/v1
```

## Authentication

All protected endpoints require Bearer token:

```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Register new user |
| POST | /auth/login | Authenticate user |
| POST | /auth/refresh | Refresh access token |
| POST | /auth/logout | Invalidate token |

### Produce

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /produce/grade | Submit image for AI grading |
| POST | /produce/listings | Create new listing |
| GET | /produce/listings | Get all listings |
| GET | /produce/listings/:id | Get listing details |
| PUT | /produce/listings/:id | Update listing |
| DELETE | /produce/listings/:id | Remove listing |

### Market

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /market/prices | Get current market prices |
| GET | /market/prices/:crop | Get price for specific crop |
| GET | /market/trends/:crop | Get price trends |

### SMS Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /sms/incoming | Africa's Talking callback |
| POST | /sms/delivery | Delivery report callback |

## Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": { },
  "meta": {
    "timestamp": "2025-01-23T10:00:00Z",
    "requestId": "uuid"
  }
}
```

## Error Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": []
  }
}
```
