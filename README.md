# CampusFind Server

CampusFind is a campus lost-and-found and claim management application backed by Express, MongoDB Atlas, and Mongoose. The implemented Member 3 backend owns claim submission and review, SDAO turnover and return rules, activity logs, and the shared demo seed verification needed by those workflows.

The consolidated project explanation is maintained in the client repository as [CampusFind Complete Project Documentation](https://github.com/Gennnnjii/campusfind-client/blob/feat/claims-sdao/docs/CAMPUSFIND_COMPLETE_DOCUMENTATION.md).

## Setup

Requirements: Node.js 20 or newer and a MongoDB Atlas connection string.

```bash
npm install
copy .env.example .env
npm run seed
npm run seed:verify
npm run dev
```

Environment variables:

```env
PORT=8000
MONGO_URI=your_mongodb_connection_string
```

Never commit `.env` or `node_modules`.

## Data model

| Collection | Important fields | Relationships and rules |
|---|---|---|
| `items` | title, description, category, location, type, dateOccurred, status, claimLocation | Found and Lost types use different allowed statuses |
| `claims` | item, claimantName, claimantEmail, proofDescription, referenceCode, status, reviewNote | Belongs to one Found item; partial unique index allows only one Approved claim per item |
| `activitylogs` | item, optional claim, action, message | Traces report, turnover, claim, recovery, and return events |
| `categories` | name, description, isActive | Referenced by items |
| `locations` | name, description, isActive | Referenced by items |

All schemas use timestamps. Claim references follow `CF-YYYYMMDD-XXXXXX` and are unique.

## Member 3 API documentation

| Method | Path | Purpose | Success |
|---|---|---|---|
| GET | `/api/claims?status=&item=` | List claims with optional filters | 200 |
| GET | `/api/claims/:id` | Get one private SDAO claim review record | 200 |
| POST | `/api/claims` | Validate eligibility, create a Pending claim, generate a reference, and log it | 201 |
| PATCH | `/api/claims/:id/status` | Approve or reject a Pending claim; approval closes competing Pending claims | 200 |
| GET | `/api/items/:id/claims` | List claims belonging to one item | 200 |
| GET | `/api/items/:id/claim-eligibility` | Return safe item details and computed eligibility | 200 |
| GET | `/api/sdao/overview` | Group items and claims into the five SDAO workflow queues | 200 |
| PATCH | `/api/sdao/items/:id/turnover` | Move a Found item from Pending Turnover to Available for Claim | 200 |
| PATCH | `/api/sdao/items/:id/return` | Mark a Found item Returned only when an Approved claim exists | 200 |
| GET | `/api/activity-logs?action=&item=&claim=&before=&limit=` | Retrieve filterable activity history, newest first | 200 |

### Sample claim request

```json
{
  "item": "30000000000000000000000b",
  "claimantName": "Demo Student",
  "claimantEmail": "demo.student@example.edu",
  "proofDescription": "There is a small blue initials label behind the inner card pocket."
}
```

### Sample claim response

```json
{
  "data": {
    "referenceCode": "CF-20261005-A1B2C3",
    "status": "Pending",
    "item": {
      "title": "Black leather wallet",
      "status": "Available for Claim",
      "claimLocation": "SDAO"
    }
  },
  "message": "Claim submitted successfully. Keep your reference code for follow-up."
}
```

### Sample review request

```json
{
  "status": "Rejected",
  "reviewNote": "Submitted identifying details do not match the item."
}
```

Errors consistently use:

```json
{
  "message": "Only Pending claims can be reviewed"
}
```

Validation errors may add a `details` array. Malformed MongoDB IDs and JSON payloads return HTTP 400, missing records return 404, successful creation returns 201, and unexpected errors return 500.

## Locked workflow rules

- Claims are accepted only for Found items in `Available for Claim`.
- The same email cannot create two Pending claims for one item.
- Claims move only from Pending to Approved or Rejected.
- Rejection requires a review note.
- Approval automatically rejects competing Pending claims for the same item.
- A partial unique database index prevents two Approved claims for one item.
- A Found item cannot become Returned without an Approved claim.
- Multi-document workflow changes use a MongoDB transaction.
- Every important transition writes an ActivityLog in the same transaction.

## Seed data and verification

`npm run seed` performs deterministic upserts; it does not clear unrelated records. Use a dedicated development database. The demo target contains:

- 7 categories
- 6 campus locations
- 26 Lost and Found reports across all lifecycle states
- 12 claims across Pending, Approved, and Rejected
- 63 activity records covering major workflows

`npm run seed:check` validates all seed documents and relationships without a database. `npm run seed:verify` repeats those checks against the configured MongoDB database after seeding.

## Tests

```bash
npm test
npm run seed:check
```

Tests cover reference generation, schema validation, type-specific item statuses, claim eligibility, API health, consistent 404/400 responses, and malformed JSON handling.

## Known limitations

- MongoDB transactions require MongoDB Atlas or another replica set; standalone MongoDB does not support this workflow safely.
- Authentication and production SDAO role enforcement are intentionally outside the required MVP.
- Email delivery, uploads, deployment, and direct finder-to-claimant contact are not included.
- Item CRUD, matching, and statistics endpoints remain owned by the other team modules.
