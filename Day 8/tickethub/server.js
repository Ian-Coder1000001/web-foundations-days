const express = require("express");
const Database = require("better-sqlite3");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const db = new Database("tickethub.db");
db.pragma("foreign_keys = ON");

// ---------- Tables (same design as ticketing-design.md) ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  venue TEXT NOT NULL,
  event_date TEXT NOT NULL,
  total_seats INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS seats (
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
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  seat_id INTEGER NOT NULL UNIQUE,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (seat_id) REFERENCES seats(id)
);
CREATE INDEX IF NOT EXISTS idx_seats_event_status ON seats(event_id, status);
`);

// ---------- Sample data (only the first time) ----------
if (db.prepare("SELECT COUNT(*) AS n FROM events").get().n === 0) {
  db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)").run("Alice", "alice@example.com", "demo");
  db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)").run("Bob", "bob@example.com", "demo");

  const addEvent = db.prepare("INSERT INTO events (name, venue, event_date, total_seats) VALUES (?, ?, ?, ?)");
  const addSeat = db.prepare("INSERT INTO seats (event_id, section, seat_number, price) VALUES (?, ?, ?, ?)");
  const events = [
    ["Afro Fest Live", "Kasarani Arena", "2026-12-12", 20],
    ["Jazz Night", "City Hall", "2026-12-20", 10],
  ];
  events.forEach(function (e, index) {
    const eventId = addEvent.run(e[0], e[1], e[2], e[3]).lastInsertRowid;
    for (let i = 1; i <= e[3]; i++) {
      const section = i <= e[3] / 2 ? "A" : "B";
      addSeat.run(eventId, section, i, section === "A" ? 100 : 60);
    }
  });
}

// ---------- Helpers ----------
// For this demo the user is chosen by the "x-user-id" header (no real login).
function getUserId(req) {
  return Number(req.headers["x-user-id"]) || 1;
}

function now() {
  return new Date().toISOString();
}

// ---------- API ----------

// List events
app.get("/api/events", function (req, res) {
  const events = db.prepare("SELECT id, name, venue, event_date, total_seats FROM events").all();
  res.json(events);
});

// List seats of an event (a held seat whose time ran out counts as available)
app.get("/api/events/:id/seats", function (req, res) {
  const seats = db.prepare(`
    SELECT id, section, seat_number, price,
      CASE WHEN status = 'held' AND held_until < ? THEN 'available' ELSE status END AS status,
      CASE WHEN status = 'held' AND held_until >= ? THEN held_by ELSE NULL END AS held_by
    FROM seats WHERE event_id = ? ORDER BY id
  `).all(now(), now(), req.params.id);
  res.json(seats);
});

// Hold seats for 10 minutes. All seats are held, or none (transaction).
const holdSeats = db.transaction(function (userId, eventId, seatIds) {
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const hold = db.prepare(`
    UPDATE seats SET status = 'held', held_by = ?, held_until = ?
    WHERE id = ? AND event_id = ?
      AND (status = 'available' OR (status = 'held' AND held_until < ?))
  `);
  seatIds.forEach(function (seatId) {
    const result = hold.run(userId, expires, seatId, eventId, now());
    if (result.changes === 0) {
      throw new Error("TAKEN");
    }
  });
  return expires;
});

app.post("/api/events/:id/holds", function (req, res) {
  const seatIds = req.body.seatIds;
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return res.status(400).json({ error: "Choose at least one seat." });
  }
  try {
    const expiresAt = holdSeats(getUserId(req), Number(req.params.id), seatIds);
    res.status(201).json({ seatIds: seatIds, expiresAt: expiresAt });
  } catch (error) {
    if (error.message === "TAKEN") {
      return res.status(409).json({ error: "Sorry, one of those seats was just taken." });
    }
    res.status(500).json({ error: "Something went wrong." });
  }
});

// Pay for all the seats this user is holding for the event (payment is pretend)
const payForSeats = db.transaction(function (userId, eventId) {
  const seats = db.prepare(`
    SELECT id, price FROM seats
    WHERE event_id = ? AND held_by = ? AND status = 'held' AND held_until > ?
  `).all(eventId, userId, now());

  if (seats.length === 0) {
    throw new Error("EXPIRED");
  }

  const total = seats.reduce(function (sum, s) { return sum + s.price; }, 0);
  const orderId = db.prepare("INSERT INTO orders (user_id, event_id, total) VALUES (?, ?, ?)")
    .run(userId, eventId, total).lastInsertRowid;

  const markSold = db.prepare("UPDATE seats SET status = 'sold', held_until = NULL WHERE id = ?");
  const addItem = db.prepare("INSERT INTO order_items (order_id, seat_id) VALUES (?, ?)");
  seats.forEach(function (s) {
    markSold.run(s.id);
    addItem.run(orderId, s.id);
  });
  return { orderId: Number(orderId), total: total, seats: seats.length };
});

app.post("/api/orders", function (req, res) {
  const eventId = Number(req.body.eventId);
  if (!eventId) {
    return res.status(400).json({ error: "eventId is required." });
  }
  try {
    const order = payForSeats(getUserId(req), eventId);
    res.status(201).json(order);
  } catch (error) {
    if (error.message === "EXPIRED") {
      return res.status(410).json({ error: "You have no held seats, or your hold expired." });
    }
    res.status(500).json({ error: "Something went wrong." });
  }
});

// My tickets
app.get("/api/me/tickets", function (req, res) {
  const tickets = db.prepare(`
    SELECT orders.id AS order_id, events.name AS event, seats.section, seats.seat_number, seats.price
    FROM orders
    JOIN order_items ON order_items.order_id = orders.id
    JOIN seats ON seats.id = order_items.seat_id
    JOIN events ON events.id = orders.event_id
    WHERE orders.user_id = ?
    ORDER BY orders.id DESC
  `).all(getUserId(req));
  res.json(tickets);
});

app.listen(3000, function () {
  console.log("TicketHub is running at http://localhost:3000");
});
