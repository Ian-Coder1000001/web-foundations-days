const textarea = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeBtn = document.querySelector("#theme-toggle");

function updateCounts() {
  const text = textarea.value;
  const chars = text.length;
  const trimmed = text.trim();
  let words = 0;
  if (trimmed !== "") {
    words = trimmed.split(/\s+/).length;
  }

  charCount.textContent = chars + " / 200 characters";
  wordCount.textContent = words + " words";

  charCount.classList.remove("warning", "over");
  if (chars > 200) {
    charCount.classList.add("over");
  } else if (chars > 180) {
    charCount.classList.add("warning");
  }
}

function clearAll() {
  textarea.value = "";
  localStorage.removeItem("draft");
  updateCounts();
}

function updateThemeLabel() {
  if (document.body.classList.contains("dark")) {
    themeBtn.textContent = "Light mode";
  } else {
    themeBtn.textContent = "Dark mode";
  }
}

textarea.addEventListener("input", function () {
  updateCounts();
  localStorage.setItem("draft", textarea.value);
});

textarea.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    clearAll();
  }
});

clearBtn.addEventListener("click", clearAll);

themeBtn.addEventListener("click", function () {
  document.body.classList.toggle("dark");
  if (document.body.classList.contains("dark")) {
    localStorage.setItem("theme", "dark");
  } else {
    localStorage.setItem("theme", "light");
  }
  updateThemeLabel();
});

// When the page loads
textarea.value = localStorage.getItem("draft") || "";
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
}
updateThemeLabel();
updateCounts();