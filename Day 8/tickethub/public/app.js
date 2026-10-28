const userSelect = document.querySelector("#user-select");
const eventSelect = document.querySelector("#event-select");
const seatGrid = document.querySelector("#seat-grid");
const holdBtn = document.querySelector("#hold-btn");
const payBtn = document.querySelector("#pay-btn");
const statusMessage = document.querySelector("#status");
const ticketsList = document.querySelector("#tickets-list");

let selected = [];

function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = type;
}

// Send a request to our server, and say which user is asking
async function api(path, options) {
  options = options || {};
  options.headers = {
    "Content-Type": "application/json",
    "x-user-id": userSelect.value,
  };
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

async function loadEvents() {
  const events = await api("/api/events");
  events.forEach(function (event) {
    const option = document.createElement("option");
    option.value = event.id;
    option.textContent = event.name + " (" + event.event_date + ")";
    eventSelect.appendChild(option);
  });
}

async function loadSeats() {
  const seats = await api("/api/events/" + eventSelect.value + "/seats");
  seatGrid.textContent = "";

  seats.forEach(function (seat) {
    const button = document.createElement("button");
    button.textContent = seat.section + seat.seat_number;
    button.classList.add("seat");

    if (seat.status === "sold") {
      button.classList.add("sold");
      button.disabled = true;
    } else if (seat.status === "held" && seat.held_by === Number(userSelect.value)) {
      button.classList.add("mine");
      button.disabled = true;
    } else if (seat.status === "held") {
      button.classList.add("other");
      button.disabled = true;
    } else if (selected.includes(seat.id)) {
      button.classList.add("selected");
    } else {
      button.classList.add("available");
    }

    button.addEventListener("click", function () {
      if (selected.includes(seat.id)) {
        selected = selected.filter(function (id) { return id !== seat.id; });
      } else {
        selected.push(seat.id);
      }
      loadSeats();
    });
    seatGrid.appendChild(button);
  });
}

async function loadTickets() {
  const tickets = await api("/api/me/tickets");
  ticketsList.textContent = "";
  if (tickets.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "You have no tickets yet.";
    ticketsList.appendChild(empty);
    return;
  }
  tickets.forEach(function (ticket) {
    const li = document.createElement("li");
    li.textContent = ticket.event + " - seat " + ticket.section + ticket.seat_number + " (order " + ticket.order_id + ")";
    ticketsList.appendChild(li);
  });
}

async function refreshAll() {
  try {
    await loadSeats();
    await loadTickets();
  } catch (error) {
    showStatus("Could not load data. Is the server running?", "error");
  }
}

holdBtn.addEventListener("click", async function () {
  holdBtn.disabled = true;
  try {
    const result = await api("/api/events/" + eventSelect.value + "/holds", {
      method: "POST",
      body: JSON.stringify({ seatIds: selected }),
    });
    showStatus("Seats held until " + new Date(result.expiresAt).toLocaleTimeString() + ". Now pay.", "success");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    selected = [];
    holdBtn.disabled = false;
    refreshAll();
  }
});

payBtn.addEventListener("click", async function () {
  payBtn.disabled = true;
  try {
    const order = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({ eventId: Number(eventSelect.value) }),
    });
    showStatus("Paid! Order " + order.orderId + ": " + order.seats + " seat(s), total " + order.total + ".", "success");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    payBtn.disabled = false;
    refreshAll();
  }
});

userSelect.addEventListener("change", function () {
  selected = [];
  showStatus("", "");
  refreshAll();
});

eventSelect.addEventListener("change", function () {
  selected = [];
  refreshAll();
});

async function start() {
  await loadEvents();
  await refreshAll();
  setInterval(refreshAll, 3000);
}
start();
