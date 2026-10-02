let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

// 1. Search notes by word (ignores upper/lower case)
function searchNotes(word) {
  return notes.filter(function (note) {
    return note.text.toLowerCase().includes(word.toLowerCase());
  });
}

// 2. Find the note with the most characters
function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  let longest = notes[0];
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].text.length > longest.text.length) {
      longest = notes[i];
    }
  }
  return longest;
}

// 3. Count how many notes are in each category
function countByCategory() {
  let counts = { personal: 0, work: 0, study: 0 };
  for (let i = 0; i < notes.length; i++) {
    counts[notes[i].category] = counts[notes[i].category] + 1;
  }
  return counts;
}

// 4. Write a one-sentence summary
function getSummary() {
  let counts = countByCategory();
  let word = "notes";
  if (notes.length === 1) {
    word = "note";
  }
  return `${notes.length} ${word}: ${counts.personal} personal, ${counts.work} work, ${counts.study} study.`;
}

// 5. Check if a note with the same text already exists
function isDuplicate(text) {
  let cleaned = text.trim().toLowerCase();
  return notes.some(function (note) {
    return note.text.trim().toLowerCase() === cleaned;
  });
}

// 6. Add a note if it passes all the checks
function addNote(text, category) {
  let cleaned = text.trim();
  if (cleaned.length < 1 || cleaned.length > 200) {
    console.log("Text must be 1-200 characters.");
    return false;
  }
  if (category !== "personal" && category !== "work" && category !== "study") {
    console.log("Category must be personal, work or study.");
    return false;
  }
  if (isDuplicate(cleaned)) {
    console.log("This note already exists.");
    return false;
  }
  let newId = notes[notes.length - 1].id + 1;
  notes.push({ id: newId, text: cleaned, category: category });
  return true;
}



// searchNotes
console.log(searchNotes("milk"));  // [ { id: 1, text: "Buy milk and bread", category: "personal" } ]
console.log(searchNotes("REVISE")); // [ { id: 4, text: "Revise JavaScript arrays", category: "study" } ]
console.log(searchNotes("zebra")); // [] (no results)

// longestNote
console.log(longestNote()); // { id: 3, text: "Email the project report to Grace", category: "work" }
let backup = notes;
notes = [];
console.log(longestNote()); // null (no notes)
notes = backup;

// countByCategory
console.log(countByCategory()); // { personal: 2, work: 1, study: 2 }
notes = [];
console.log(countByCategory()); // { personal: 0, work: 0, study: 0 }
notes = backup;

// getSummary
console.log(getSummary()); // "5 notes: 2 personal, 1 work, 2 study."
notes = [notes[4]];
console.log(getSummary()); // "1 note: 1 personal, 0 work, 0 study."
notes = backup;

// isDuplicate
console.log(isDuplicate("buy milk and bread")); // true (ignores case)
console.log(isDuplicate("  CALL MUM  "));        // true (ignores case and extra spaces)
console.log(isDuplicate("Walk the dog"));        // false

// addNote
console.log(addNote("Walk the dog", "personal")); // true (note added)
console.log(addNote("call mum", "personal"));     // logs "This note already exists." then false
console.log(addNote("   ", "work"));              // logs "Text must be 1-200 characters." then false
console.log(addNote("a".repeat(201), "work"));    // logs "Text must be 1-200 characters." then false
console.log(addNote("Plan holiday", "fun"));      // logs "Category must be personal, work or study." then false
console.log(notes.length);                        // 6 (only one note was added)
console.log(getSummary());                        // "6 notes: 3 personal, 1 work, 2 study."