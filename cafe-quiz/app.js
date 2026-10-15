(() => {
  const data = window.CAFE_QUIZ;
  if (!data) {
    document.getElementById("stage").textContent = "Quiz data failed to load.";
    return;
  }

  const stage = document.getElementById("stage");
  const toolbar = document.getElementById("toolbar");
  const statsEl = document.getElementById("stats");
  const installHint = document.getElementById("installHint");

  const state = {
    mode: "home",
    cat: "All",
    deck: [],
    i: 0,
    revealed: false,
    score: { right: 0, wrong: 0, seen: 0 },
    answered: false
  };

  const cats = ["All", ...new Set([
    ...data.flashcards.map((c) => c.cat),
    ...data.mc.map((c) => c.cat)
  ])].sort((a, b) => (a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b)));

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function filteredFlash() {
    return data.flashcards.filter((c) => state.cat === "All" || c.cat === state.cat);
  }

  function filteredMc() {
    return data.mc.filter((c) => state.cat === "All" || c.cat === state.cat);
  }

  function buildDeck() {
    if (state.mode === "flash") {
      state.deck = shuffle(filteredFlash().map((c) => ({ type: "flash", ...c })));
    } else if (state.mode === "mc") {
      state.deck = shuffle(filteredMc().map((c) => ({ type: "mc", ...c })));
    } else if (state.mode === "mix") {
      state.deck = shuffle([
        ...filteredFlash().map((c) => ({ type: "flash", ...c })),
        ...filteredMc().map((c) => ({ type: "mc", ...c }))
      ]);
    } else {
      state.deck = [];
    }
    state.i = 0;
    state.revealed = false;
    state.answered = false;
    state.score = { right: 0, wrong: 0, seen: 0 };
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    if (mode === "home") {
      toolbar.hidden = true;
      statsEl.hidden = true;
      renderHome();
      return;
    }
    toolbar.hidden = false;
    statsEl.hidden = false;
    renderToolbar();
    buildDeck();
    renderCard();
  }

  function renderToolbar() {
    toolbar.innerHTML = "";
    cats.forEach((cat) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `chip${state.cat === cat ? " active" : ""}`;
      chip.textContent = cat;
      chip.addEventListener("click", () => {
        state.cat = cat;
        buildDeck();
        renderToolbar();
        renderCard();
      });
      toolbar.appendChild(chip);
    });

    const reshuffle = document.createElement("button");
    reshuffle.type = "button";
    reshuffle.className = "action primary";
    reshuffle.textContent = "Shuffle";
    reshuffle.addEventListener("click", () => {
      buildDeck();
      renderCard();
    });
    toolbar.appendChild(reshuffle);
  }

  function renderStats() {
    const { right, wrong, seen } = state.score;
    const left = Math.max(state.deck.length - state.i, 0);
    statsEl.innerHTML = `<span><b>${seen}</b> seen</span><span><b>${right}</b> right</span><span><b>${wrong}</b> miss</span><span><b>${left}</b> left</span>`;
  }

  function renderHome() {
    stage.className = "card home-card";
    stage.innerHTML = `
      <p class="prompt">Cafe drills for honest Tier-1 talk.</p>
      <p>Built from your co-pilot prompt: Boundry facts, desk jargon, tools, identity, and safe spoken lines.</p>
      <ul class="tips">
        <li><b>Flashcards</b>: see the term, flip for meaning + cafe sentence.</li>
        <li><b>Multiple choice</b>: pick the best answer, read the why.</li>
        <li><b>Mixed</b>: both decks shuffled for happy-hour chaos.</li>
      </ul>
      <p>${data.flashcards.length} flashcards · ${data.mc.length} MC questions. No dumps. No fake senior years.</p>
      <div class="footer-actions">
        <button class="ghost accent" type="button" data-go="flash">Start flashcards</button>
        <button class="ghost" type="button" data-go="mc">Start MC</button>
      </div>
    `;
    stage.querySelectorAll("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.go));
    });
  }

  function current() {
    return state.deck[state.i];
  }

  function next() {
    if (state.i < state.deck.length - 1) {
      state.i += 1;
      state.revealed = false;
      state.answered = false;
      renderCard();
      return;
    }
    stage.className = "card home-card";
    stage.innerHTML = `
      <p class="prompt">Deck complete.</p>
      <p>Right <b>${state.score.right}</b> · Miss <b>${state.score.wrong}</b> · Seen <b>${state.score.seen}</b></p>
      <div class="footer-actions">
        <button class="ghost accent" type="button" id="again">Shuffle again</button>
        <button class="ghost" type="button" id="home">Home</button>
      </div>
    `;
    document.getElementById("again").addEventListener("click", () => {
      buildDeck();
      renderCard();
    });
    document.getElementById("home").addEventListener("click", () => setMode("home"));
    renderStats();
  }

  function renderFlash(item) {
    stage.className = "card";
    stage.innerHTML = `
      <div class="meta"><span>${item.cat}</span><span>Flashcard ${state.i + 1}/${state.deck.length}</span></div>
      <p class="prompt">${escapeHtml(item.front)}</p>
      <div class="answer-block${state.revealed ? " show" : ""}" id="answer">
        <h3>Means</h3>
        <p>${escapeHtml(item.back)}</p>
        <h3>Say this</h3>
        <div class="say">${escapeHtml(item.say)}</div>
      </div>
      <div class="footer-actions">
        <button class="ghost accent" type="button" id="flip">${state.revealed ? "Next" : "Reveal"}</button>
        ${state.revealed ? '<button class="ghost" type="button" id="got">Got it</button><button class="ghost" type="button" id="againCard">Again later</button>' : ""}
      </div>
    `;
    document.getElementById("flip").addEventListener("click", () => {
      if (!state.revealed) {
        state.revealed = true;
        state.score.seen += 1;
        renderCard();
        return;
      }
      next();
    });
    const got = document.getElementById("got");
    const again = document.getElementById("againCard");
    if (got) {
      got.addEventListener("click", () => {
        state.score.right += 1;
        next();
      });
    }
    if (again) {
      again.addEventListener("click", () => {
        state.score.wrong += 1;
        state.deck.push(item);
        next();
      });
    }
  }

  function renderMc(item) {
    stage.className = "card";
    const choices = item.choices
      .map(
        (text, idx) =>
          `<button class="choice" type="button" data-idx="${idx}" ${state.answered ? "disabled" : ""}>${escapeHtml(text)}</button>`
      )
      .join("");

    stage.innerHTML = `
      <div class="meta"><span>${item.cat}</span><span>MC ${state.i + 1}/${state.deck.length}</span></div>
      <p class="prompt">${escapeHtml(item.q)}</p>
      <div class="choices" id="choices">${choices}</div>
      <div class="feedback" id="feedback"></div>
      <div class="footer-actions">
        <button class="ghost accent" type="button" id="next" ${state.answered ? "" : "disabled"} style="opacity:${state.answered ? 1 : 0.45}">Next</button>
      </div>
    `;

    const feedback = document.getElementById("feedback");
    stage.querySelectorAll(".choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (state.answered) return;
        state.answered = true;
        state.score.seen += 1;
        const idx = Number(btn.dataset.idx);
        const correct = idx === item.answer;
        if (correct) state.score.right += 1;
        else state.score.wrong += 1;

        stage.querySelectorAll(".choice").forEach((c) => {
          c.disabled = true;
          const cIdx = Number(c.dataset.idx);
          if (cIdx === item.answer) c.classList.add("correct");
          if (cIdx === idx && !correct) c.classList.add("wrong");
        });

        feedback.className = `feedback show ${correct ? "ok" : "bad"}`;
        feedback.textContent = `${correct ? "Nice." : "Not that one."} ${item.why}`;
        const nextBtn = document.getElementById("next");
        nextBtn.disabled = false;
        nextBtn.style.opacity = 1;
        renderStats();
      });
    });

    document.getElementById("next").addEventListener("click", () => {
      if (!state.answered) return;
      next();
    });
  }

  function renderCard() {
    renderStats();
    const item = current();
    if (!item) {
      stage.className = "card";
      stage.innerHTML = `<p class="empty">No cards in this category. Pick All or another chip.</p>`;
      return;
    }
    if (item.type === "flash") renderFlash(item);
    else renderMc(item);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  // Show install hint on mobile browsers
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (!isStandalone && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    installHint.classList.add("show");
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  setMode("home");
})();
