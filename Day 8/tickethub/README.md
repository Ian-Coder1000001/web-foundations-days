# TicketHub (working demo)

A small working version of the TicketHub design in `../ticketing-design.md`. It shows how seats are held and bought without double-booking.

## How to run

1. Install Node.js (version 18 or newer) from nodejs.org.
2. Open a terminal in this folder (`day8/tickethub`).
3. Run `npm install` (only the first time).
4. Run `npm start`.
5. Open http://localhost:3000 in your browser.

To start again with fresh data, stop the server and delete the file `tickethub.db`.

## Try the double-booking test

1. Choose **Alice**, click two seats, then click **Hold selected seats**.
2. Switch to **Bob**. Alice's seats are orange and cannot be clicked.
3. To see the database protect a seat, open the page in **two browser tabs**, select the same seat in both (as Alice in one tab and Bob in the other) and click Hold in both. Only one tab succeeds. The other shows "Sorry, one of those seats was just taken."
4. As Alice, click **Pay for my held seats**. The seats turn grey and appear in "My tickets".

## What is simplified compared with the design document

- There is no real login. You pick Alice or Bob from a list.
- Payment is pretend.
- It runs on one server with one SQLite database. The CDN, cache, load balancer, waiting room and queue from the architecture are not built.
- Paying buys all the seats you are holding for the event (there is no separate hold id).

## Files

- `server.js`: the API and the database (tables, hold, pay, tickets)
- `public/`: the web page (`index.html`, `style.css`, `app.js`)
