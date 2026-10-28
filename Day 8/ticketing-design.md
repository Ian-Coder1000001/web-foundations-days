# TicketHub Design Document

TicketHub is a website that sells tickets for concerts and events. This document follows the six-part design framework: requirements, estimates, API, data model, architecture, and trade-offs.

## 1. Requirements

### Functional
- Users can register and log in.
- Users can browse events and see event details.
- Users can see which seats are available for an event.
- Users can hold seats for a short time (10 minutes) while they pay.
- Users can pay for held seats and receive tickets.
- Users can view their tickets.

### Non-functional
- **Correctness (most important):** a seat must never be sold to two people.
- **Speed:** browsing pages load in under 1 second.
- **Availability during a big sale:** the site must stay up when 200,000 people arrive at once.
- **Fairness:** people are served in the order they arrive, with no advantage for bots or people who refresh the most.
- **Security:** card details are handled only by a payment provider, and only the owner can see their tickets.
- **Reliability:** a paid ticket must never be lost.

## 2. Estimates

Facts: 2 million registered users; 50,000 visitors on a normal day, each viewing 10 pages; 5,000 tickets sold on a normal day; in a big sale, 200,000 people try to buy 20,000 seats in the first 10 minutes.

### Normal day
| Item | Calculation | Result |
|---|---|---|
| Page views per day | 50,000 × 10 | 500,000 |
| Page views per second | 500,000 ÷ 86,400 | about 6 average, about 30 at peak (5×) |
| Tickets sold per second | 5,000 ÷ 86,400 | about 0.06 (one sale every 17 seconds) |

### Big sale (first 10 minutes = 600 seconds)
Assumption: each buyer makes about 10 requests (event page, seat map, a few refreshes, hold, pay).

| Item | Calculation | Result |
|---|---|---|
| New people arriving | 200,000 ÷ 600 | about 333 per second |
| Requests per second | 200,000 × 10 ÷ 600 | about 3,300 per second |
| Seat hold attempts | 200,000 ÷ 600 | about 333 per second |
| Successful sales | 20,000 ÷ 600 | about 33 per second |
| People per seat | 200,000 ÷ 20,000 | 10 people want each seat |

### Comparison
The big sale has about **550 times** more traffic than a normal day's average (3,300 vs 6 requests per second) and about 500 times more sales per second (33 vs 0.06). It is a short, sudden spike, and 9 out of 10 people will not get a seat. The design must be built for the spike, not for the normal day.

## 3. API

All paths start with `/api/v1`. Data is JSON.

| Method | Path | Description | Success status |
|---|---|---|---|
| POST | `/login` | Log in and get a token | 200 OK |
| GET | `/events` | List events (optional `?city=Nairobi`) | 200 OK |
| GET | `/events/{id}` | Get one event's details | 200 OK |
| GET | `/events/{id}/seats` | List seats with their status (available, held, sold) | 200 OK |
| POST | `/events/{id}/holds` | Hold one or more seats for 10 minutes | 201 Created |
| DELETE | `/holds/{id}` | Release a hold | 204 No Content |
| POST | `/orders` | Pay for a hold and create the order | 201 Created |
| GET | `/me/tickets` | List the logged-in user's tickets | 200 OK |

Example: hold seats

`POST /api/v1/events/12/holds`
```json
{ "seatIds": [301, 302] }
```
Response (201 Created):
```json
{ "holdId": 77, "seatIds": [301, 302], "expiresAt": "2026-11-01T18:10:00Z" }
```

Example: pay

`POST /api/v1/orders`
```json
{ "holdId": 77, "paymentToken": "tok_abc123" }
```

Errors:
- **400:** the request is wrong (no seats chosen).
- **401:** not logged in.
- **404:** the event or hold does not exist.
- **409 Conflict:** a seat was taken by someone else.
- **410 Gone:** the hold expired.
- **402:** the payment failed.
- **429:** too many requests.

## 4. Data model

### Tables
- **users:** `id` (PK), `name`, `email` (unique), `password_hash`.
- **events:** `id` (PK), `name`, `venue`, `event_date`, `total_seats`.
- **seats:** `id` (PK), `event_id` (FK to events), `section`, `seat_number`, `price`, `status` (available, held or sold), `held_by` (FK to users, empty if not held), `held_until`.
- **orders:** `id` (PK), `user_id` (FK to users), `event_id` (FK to events), `total`, `created_at`.
- **order_items:** `id` (PK), `order_id` (FK to orders), `seat_id` (FK to seats, **UNIQUE**).

### Relationships
- One user has many orders (one-to-many).
- One event has many seats (one-to-many).
- One order has many order items (one-to-many), and each order item is one seat.
- Users and seats are many-to-many through orders and order_items. A join table is needed because one order can contain many seats.

### SQL

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  venue TEXT NOT NULL,
  event_date TEXT NOT NULL,
  total_seats INTEGER NOT NULL
);

CREATE TABLE seats (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL,
  section TEXT NOT NULL,
  seat_number INTEGER NOT NULL,
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'held', 'sold')),
  held_by INTEGER,
  held_until TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (held_by) REFERENCES users(id),
  UNIQUE (event_id, section, seat_number)
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  seat_id INTEGER NOT NULL UNIQUE,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (seat_id) REFERENCES seats(id)
);

CREATE INDEX idx_seats_event_status ON seats(event_id, status);
```
The index speeds up "show the available seats for this event", which is the most common query.

## 5. How the design prevents double-booking

Three layers protect each seat. Layer 1 and 2 stop it in normal use, and layer 3 is a safety net.

**Layer 1: an atomic hold.** To hold a seat, the app server runs one SQL statement that checks and changes the seat at the same moment:

```sql
UPDATE seats
SET status = 'held', held_by = :user_id, held_until = :expires_at
WHERE id = :seat_id
  AND (status = 'available' OR (status = 'held' AND held_until < :now));
```
If two people click the same seat at the same instant, the database processes the two updates one after the other. The first changes the row, so the second one no longer matches the `WHERE` condition and changes **0 rows**. The app checks this: 1 row changed means success, and 0 rows means "409 Conflict, seat already taken". We never read the seat first and then write, because another user could change it between the two steps.

**Layer 2: a transaction.** If a user picks several seats, all the updates run inside one transaction (`BEGIN` ... `COMMIT`). If any seat fails, the app runs `ROLLBACK`, so the user gets all the seats or none, and no seat is left stuck. Payment works the same way: in one transaction the app marks the seats as `sold` only `WHERE held_by = :user_id AND held_until > :now`, then creates the order and its items.

**Layer 3: a constraint.** `order_items.seat_id` is `UNIQUE`. Even if there were a bug in the code, the database would refuse to put the same seat in two orders and the second order would fail.

**Expired holds:** a hold lasts 10 minutes. After that the `WHERE` condition above lets the next person take the seat, and a background worker also resets old holds to `available`.

## 6. Architecture

```
        [Client: browser / mobile app]
                     |
                   [DNS]
                     |
                   [CDN]  (event pages, images, CSS, JS)
                     |
           [Waiting Room / Rate Limiter]
                     |
              [Load Balancer]
                     |
        +------------+------------+
        |            |            |
   [App Server 1] [App Server 2] [App Server N]   (stateless)
        |            |            |
        +-----+------+------+-----+
              |             |
           [Cache]   [Database Primary] ---> [Database Read Replica]
                            |
                         [Queue] ---> [Workers]
                                       (emails, expired holds)
              [App Servers] ---> [Payment Provider]
```

### Components (the problem each one solves)
- **DNS:** turns the website name into our system's address.
- **CDN:** serves pages, images and scripts from servers near the user, so most browsing traffic never reaches us.
- **Waiting room and rate limiter:** lets people into the sale at a steady speed, in the order they arrived, so the system is not crushed by 200,000 people at once, and it blocks bots that send too many requests.
- **Load balancer:** spreads requests over the app servers, so no single server is overwhelmed.
- **App servers (stateless):** run the API code, and because they store nothing locally we can add many more before a sale.
- **Cache:** stores event details and the seat map for a second or two, so thousands of people looking at the seat map do not each hit the database.
- **Primary database:** the one place where seats are held and sold, so it decides who wins each seat.
- **Read replica:** serves browsing reads, so they do not slow down the seat updates.
- **Queue and workers:** send confirmation emails and release expired holds in the background, so buying stays fast.
- **Payment provider:** handles card details securely, so we never store them.

### How it survives the big sale
1. **Before the sale:** add more app servers ahead of time and warm the cache with the event's data.
2. **At the start:** the CDN and cache absorb the browsing traffic, and the waiting room lets in only as many people as the database can handle (for example, a few hundred per second).
3. **During the sale:** only the real seat holds and payments (about 333 and 33 per second) reach the primary database, which is a small load for one database. The cached seat map may be a second old, but the database always decides, so wrong clicks just get a friendly 409.
4. **After the sale:** the waiting room is closed, and workers send emails and free up unpaid seats.

### Avoiding single points of failure
Run two or more app servers, a standby load balancer, and a replica that can be promoted to primary. If the cache fails, requests fall back to the database (slower but working).

## 7. Trade-offs
- **Waiting room: fairness and stability vs convenience.** People wait in line and cannot buy instantly, but the system stays up and the order is fair.
- **Cached seat map: speed vs accuracy.** The seat map may be a second or two out of date, so someone can click a seat that was just taken and get a 409. We accept this because the database still guarantees correctness, and it saves a huge amount of load.
- **Hold time: 10 minutes.** A longer hold gives people time to pay but keeps seats locked longer. A shorter hold frees seats sooner but may annoy slow payers.
- **One primary database: simple and correct vs limited writes.** One primary makes double-booking easy to prevent, and 333 writes per second is well within its limits. Splitting the database across many servers would scale writes further but make correctness much harder.
