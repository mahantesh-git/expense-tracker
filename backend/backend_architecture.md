# 🏗️ Expense Tracker — Backend Architecture

> **Stack:** Node.js · Express.js · MongoDB (Mongoose) · JWT Auth · bcryptjs · Nodemailer

---

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│                    React + Vite (Port 5173)                       │
└─────────────────────────────┬────────────────────────────────────┘
                              │ HTTPS / REST API
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS SERVER (Port 5000)                │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Helmet  │  │   CORS     │  │  Gzip    │  │  Rate Limiter │  │
│  │(Security)│  │(Whitelist) │  │(Compress)│  │(100r/15m IP)  │  │
│  └──────────┘  └────────────┘  └──────────┘  └───────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     JWT Middleware (protect)                │ │
│  │          Verifies Bearer token → attaches req.user          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ /api/auth    │  │ /api/expenses│  │ /api/expense-requests │   │
│  ├──────────────┤  ├──────────────┤  ├──────────────────────┤   │
│  │/api/settle.. │  │/api/notific..│  │   /api/health         │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────┬────────────────────────────────────┘
                              │ Mongoose ODM
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                          MONGODB                                  │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐ ┌──────────────┐  │
│  │  users   │ │ expenses │ │expense_requests│ │ settlements  │  │
│  └──────────┘ └──────────┘ └────────────────┘ └──────────────┘  │
│                         ┌───────────────┐                        │
│                         │ notifications │                        │
│                         └───────────────┘                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Security & Middleware Stack

| Layer            | Module                 | Purpose                                                      |
| ---------------- | ---------------------- | ------------------------------------------------------------ |
| Security Headers | `helmet`             | XSS, clickjacking, MIME-type protection                      |
| CORS             | `cors`               | Whitelist: localhost + `*.onrender.com` + `FRONTEND_URL` |
| Compression      | `compression`        | Gzip all responses                                           |
| Rate Limiting    | `express-rate-limit` | 100 req / 15 min per IP on `/api/auth`                     |
| Auth Guard       | `protect` middleware | Validates JWT; attaches `req.user`                         |
| Role Guard       | `admin` middleware   | Allows only `role === 'admin'`                             |

---

## 3. Authentication Flow (JWT)

### 3.1 Login Flow

```
Client                     Server                         MongoDB
  │                           │                              │
  │  POST /api/auth/login     │                              │
  │  { username, password }   │                              │
  │──────────────────────────►│                              │
  │                           │  User.findOne({ username })  │
  │                           │─────────────────────────────►│
  │                           │◄─────────────────────────────│
  │                           │  bcrypt.compare(password)    │
  │                           │  if match → jwt.sign({id})   │
  │◄──────────────────────────│                              │
  │  200: { _id, username,    │                              │
  │         role, token }     │                              │
```

- **Token expiry:** 30 days (`jwt.sign({ id }, SECRET, { expiresIn: '30d' })`)
- **Deactivated accounts** return `403` before password check

### 3.2 Protected Request Flow

```
Client                     protect Middleware              MongoDB
  │                              │                            │
  │  GET /api/expenses           │                            │
  │  Authorization: Bearer <JWT> │                            │
  │─────────────────────────────►│                            │
  │                              │  jwt.verify(token)         │
  │                              │  User.findById(decoded.id) │
  │                              │───────────────────────────►│
  │                              │◄───────────────────────────│
  │                              │  Check isActive flag       │
  │                              │  → attach req.user         │
  │                              │  → call next()             │
  │◄─────────────────────────────│                            │
  │  Route handler runs          │                            │
```

### 3.3 Password Reset (OTP Flow) — Admin Only

```
Admin          Server                    Email Service       Target User
  │                │                          │                  │
  │ POST           │                          │                  │
  │ /reset-otp/:em │ Generate 6-digit OTP     │                  │
  │───────────────►│ Store in user.otp        │                  │
  │                │ otpExpiry = now + 10min  │                  │
  │                │──────────────────────────►                  │
  │                │  sendEmail(OTP)          │  Email with OTP  │
  │◄───────────────│                          │─────────────────►│
  │  200: OTP sent │                          │                  │
  │                │                          │                  │
  │ PUT /reset-pwd │                          │                  │
  │ { otp, email,  │ Validate OTP             │                  │
  │   newPassword }│ Check expiry             │                  │
  │───────────────►│ bcrypt.hash(newPassword) │                  │
  │                │ Clear otp, otpExpiry     │                  │
  │◄───────────────│                          │                  │
  │ 200: Success   │                          │                  │
```

---

## 4. Data Models

### 4.1 User

```js
{
  username:  String  (unique, required)
  password:  String  (bcrypt hashed)
  email:     String  (sparse unique — optional)
  role:      "admin" | "client"   (default: "client")
  otp:       String  (null when inactive)
  otpExpiry: Date    (null when inactive)
  isActive:  Boolean (default: true)
  createdAt, updatedAt
}
```

### 4.2 Expense

```js
{
  description: String  (required)
  amount:      Number  (required)
  payer:       ObjectId → User
  splits: [{
    user:       ObjectId → User
    amountOwed: Number
  }]
  date:       Date  (default: now)
  createdAt, updatedAt
}
```

### 4.3 ExpenseRequest

```js
{
  description:      String
  amount:           Number
  requestedBy:      ObjectId → User
  payer:            ObjectId → User   (= requestedBy at creation)
  splitType:        "equal" | "custom"
  splits:           [{ user, amountOwed }]
  status:           "pending" | "approved" | "rejected"
  adminNote:        String | null
  approvedExpenseId: ObjectId → Expense | null
  date:             Date
  createdAt, updatedAt
}
```

### 4.4 Settlement

```js
{
  payer:       ObjectId → User
  receiver:    ObjectId → User
  amount:      Number
  date:        Date
  description: String  (default: "Net balance settlement")
  createdAt, updatedAt
}
```

### 4.5 Notification

```js
{
  recipient:        ObjectId → User  (indexed)
  type:             "request_submitted" | "request_approved" | "request_rejected"
  title:            String
  message:          String
  relatedRequestId: ObjectId → ExpenseRequest | null
  read:             Boolean  (default: false)
  createdAt, updatedAt
}
```

---

## 5. Database Relationships

```
User ──────────────────┐
  │                    │  (payer)
  │  (requestedBy)     ▼
  └──────────► ExpenseRequest ──[approve]──► Expense
                    │                           │
                    │ (notify)                  │ (splits[].user)
                    ▼                           ▼
               Notification               User (split participants)
                    │
                    │ (relatedRequestId)
                    └──────────────────────────► ExpenseRequest

Settlement: User (payer) ──────────────────► User (receiver)
```

---

## 6. API Reference

### 6.1 Auth APIs — `/api/auth`

| Method    | Endpoint                       | Auth | Role  | Description                                   |
| --------- | ------------------------------ | ---- | ----- | --------------------------------------------- |
| `POST`  | `/login`                     | ❌   | —    | Login with username + password → JWT         |
| `POST`  | `/register`                  | ✅   | Admin | Create new client user (password = username)  |
| `GET`   | `/me`                        | ✅   | Any   | Get current user profile                      |
| `GET`   | `/users`                     | ✅   | Admin | List all users                                |
| `GET`   | `/peers`                     | ✅   | Any   | List all active clients (for split selection) |
| `PATCH` | `/profile`                   | ✅   | Any   | Update own username                           |
| `POST`  | `/change-password`           | ✅   | Any   | Change own password (verify old first)        |
| `POST`  | `/reset-password-otp/:email` | ✅   | Admin | Send OTP to user email                        |
| `PUT`   | `/reset-password/:userId`    | ✅   | Admin | Apply new password using OTP                  |
| `PATCH` | `/users/:id/status`          | ✅   | Admin | Toggle user active/inactive                   |

---

### 6.2 Expense APIs — `/api/expenses`

| Method   | Endpoint | Auth | Role  | Description                                        |
| -------- | -------- | ---- | ----- | -------------------------------------------------- |
| `POST` | `/`    | ✅   | Admin | Directly create an expense (bypasses request flow) |
| `GET`  | `/`    | ✅   | Any   | Admin: all expenses. Client: own expenses only     |
| `PUT`  | `/:id` | ✅   | Admin | Update expense fields                              |

> **Note:** Clients must use `/api/expense-requests` — direct `POST /expenses` is admin-only.

---

### 6.3 Expense Request APIs — `/api/expense-requests`

| Method     | Endpoint           | Auth | Role        | Description                                    |
| ---------- | ------------------ | ---- | ----------- | ---------------------------------------------- |
| `POST`   | `/`              | ✅   | Client      | Submit a new expense request; notifies admin   |
| `GET`    | `/`              | ✅   | Any         | Admin: all requests. Client: own requests      |
| `GET`    | `/pending-count` | ✅   | Admin       | Count of pending requests                      |
| `PUT`    | `/:id/approve`   | ✅   | Admin       | Approve → creates Expense + notifies client   |
| `PUT`    | `/:id/reject`    | ✅   | Admin       | Reject + optional admin note + notifies client |
| `DELETE` | `/:id`           | ✅   | Owner/Admin | Cancel a pending request                       |

---

### 6.4 Settlement APIs — `/api/settlements`

| Method   | Endpoint | Auth | Role  | Description                                       |
| -------- | -------- | ---- | ----- | ------------------------------------------------- |
| `POST` | `/`    | ✅   | Admin | Record a payment settlement; sends email to payer |
| `GET`  | `/`    | ✅   | Any   | Admin: all. Client: own settlements only          |

---

### 6.5 Notification APIs — `/api/notifications`

| Method  | Endpoint          | Auth | Role | Description                                  |
| ------- | ----------------- | ---- | ---- | -------------------------------------------- |
| `GET` | `/`             | ✅   | Any  | Get latest 10 notifications for current user |
| `GET` | `/unread-count` | ✅   | Any  | Count of unread notifications                |
| `PUT` | `/:id/read`     | ✅   | Any  | Mark single notification as read             |
| `PUT` | `/read-all`     | ✅   | Any  | Mark all notifications as read               |

---

### 6.6 Health Check

| Method  | Endpoint        | Auth | Description                      |
| ------- | --------------- | ---- | -------------------------------- |
| `GET` | `/api/health` | ❌   | Returns DB state + server uptime |

---

## 7. Core Business Flows

### 7.1 Client Submits an Expense Request

```
Client                    Server                        Admin (via notification)
  │                          │                                  │
  │  POST /api/expense-      │  Validate fields & split total   │
  │  requests                │  Must be ≤ expense amount        │
  │  { description, amount,  │  Must be ≥ ₹0.01                │
  │    splitType, splits }   │                                  │
  │─────────────────────────►│                                  │
  │                          │  MongoDB Transaction:            │
  │                          │  1. Create ExpenseRequest        │
  │                          │     (status: "pending")          │
  │                          │  2. Create Notification          │
  │                          │     for admin                    │
  │                          │  3. Commit                       │
  │◄─────────────────────────│                                  │
  │  201: populated request  │  Admin gets bell notification ──►│
```

### 7.2 Admin Approves a Request

```
Admin                     Server                        Client (notified)
  │                          │                                │
  │  PUT /api/expense-       │                               │
  │  requests/:id/approve    │  Check status === "pending"    │
  │─────────────────────────►│                               │
  │                          │  MongoDB Transaction:          │
  │                          │  1. Create Expense from        │
  │                          │     ExpenseRequest data        │
  │                          │  2. Update request.status      │
  │                          │     → "approved"               │
  │                          │  3. Store approvedExpenseId    │
  │                          │  4. Create Notification        │
  │                          │     for client                 │
  │                          │  5. Commit                     │
  │◄─────────────────────────│                               │
  │  200: { request, expense}│  Client gets notification ───►│
```

### 7.3 Admin Records a Settlement

```
Admin                     Server                        Payer (email)
  │                          │                               │
  │  POST /api/settlements   │                               │
  │  { payer, receiver,      │  MongoDB Transaction:         │
  │    amount, description } │  1. Create Settlement doc     │
  │─────────────────────────►│  2. Commit                    │
  │                          │  3. Lookup payer email        │
  │                          │  4. Fire-and-forget email     │
  │◄─────────────────────────│────────────────── email ─────►│
  │  201: settlement         │                               │
```

### 7.4 Auto-Seeding Admin on First Boot

```
Server Start
  │
  ├── Connect MongoDB
  │
  ├── User.countDocuments() === 0?
  │       YES → Create admin user:
  │              username = "admin"
  │              email    = process.env.EMAIL_ADDRESS
  │              password = bcrypt(process.env.ADMIN_PASSWORD)
  │              role     = "admin"
  │
  └── Start HTTP listener on PORT
```

---

## 8. Role Permission Matrix

| Feature                         | Admin | Client   |
| ------------------------------- | ----- | -------- |
| Login                           | ✅    | ✅       |
| View own profile                | ✅    | ✅       |
| Update own username             | ✅    | ✅       |
| Change own password             | ✅    | ✅       |
| View all users                  | ✅    | ❌       |
| Register new user               | ✅    | ❌       |
| Toggle user active/inactive     | ✅    | ❌       |
| Reset any user's password (OTP) | ✅    | ❌       |
| Create expense directly         | ✅    | ❌       |
| View all expenses               | ✅    | Own only |
| Update expense                  | ✅    | ❌       |
| Submit expense request          | ✅*   | ✅       |
| View all expense requests       | ✅    | Own only |
| Approve / Reject request        | ✅    | ❌       |
| Cancel pending request          | ✅    | Own only |
| Record settlement               | ✅    | ❌       |
| View settlements                | ✅    | Own only |
| View notifications              | ✅    | ✅       |

> *Admin can also submit expense requests, but typically uses direct expense creation.

---

## 9. Transaction Strategy

Every write that touches multiple collections uses **Mongoose sessions with atomic transactions**:

```
POST /expense-requests  → [ExpenseRequest + Notification]     → commit/abort
PUT  /:id/approve       → [Expense + ExpenseRequest + Notif.] → commit/abort
PUT  /:id/reject        → [ExpenseRequest + Notification]     → commit/abort
POST /auth/register     → [User]                              → commit/abort
PUT  /reset-password    → [User]                              → commit/abort
POST /settlements       → [Settlement]                        → commit/abort
```

---

## 10. Environment Variables

| Variable           | Purpose                                               |
| ------------------ | ----------------------------------------------------- |
| `PORT`           | Server listen port (default: 5000)                    |
| `MONGODB_URI`    | MongoDB connection string                             |
| `JWT_SECRET`     | JWT signing secret                                    |
| `ADMIN_PASSWORD` | Initial admin password (seeded on first boot)         |
| `EMAIL_ADDRESS`  | Admin email address (used for seeding + email sender) |
| `FRONTEND_URL`   | Production frontend URL for CORS whitelist            |
| `EMAIL_*`        | Nodemailer SMTP config (host, port, user, pass)       |

---

## 11. File Structure

```
backend/
├── server.js                  ← App entry: middleware, routes, DB connect, seeding
├── middleware/
│   └── auth.js                ← protect() + admin() middleware
├── models/
│   ├── User.js
│   ├── Expense.js
│   ├── ExpenseRequest.js
│   ├── Settlement.js
│   └── Notification.js
├── routes/
│   ├── authRoutes.js          ← /api/auth/*
│   ├── expenseRoutes.js       ← /api/expenses/*
│   ├── expenseRequestRoutes.js← /api/expense-requests/*
│   ├── settlementRoutes.js    ← /api/settlements/*
│   └── notificationRoutes.js  ← /api/notifications/*
└── utils/
    ├── sendEmail.js           ← Nodemailer wrapper
    └── demo.js                ← Demo/seed utilities
```
