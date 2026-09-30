(() => {
  const deckEl = document.querySelector(".deck");
  const slides = [...deckEl.querySelectorAll(".slide")];

  document.body.insertAdjacentHTML(
    "afterbegin",
    `<button class="menu-button" type="button" aria-label="목차 열기">☰</button>
    <nav class="sidebar" aria-label="슬라이드 목차">
      <div class="sidebar-head">
        <strong></strong>
        <button class="close-menu" type="button" aria-label="목차 닫기">«</button>
      </div>
      <ul class="nav-list"></ul>
    </nav>`,
  );
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="click-hint">클릭 또는 Space: 다음 / ←: 뒤로 / M: 목차 / N: 노트</div>
    <div class="controls">
      <button type="button" data-action="prev" aria-label="뒤로 가기">←</button>
      <span class="counter"></span>
      <span class="frag-dots" aria-label="현재 슬라이드의 클릭 진행 상태"></span>
      <button type="button" data-action="next" aria-label="다음">→</button>
    </div>
    <div class="progress"><div class="progress-bar"></div></div>
    <aside class="notes-panel" aria-label="발표자 노트" aria-live="polite"></aside>`,
  );

  const navList = document.querySelector(".nav-list");
  const counter = document.querySelector(".counter");
  const fragDots = document.querySelector(".frag-dots");
  const progressBar = document.querySelector(".progress-bar");
  const notesPanel = document.querySelector(".notes-panel");
  document.querySelector(".sidebar-head strong").textContent = deckEl.dataset.deckTitle || document.title;
  let current = 0;

  const navButtons = slides.map((slide, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const number = document.createElement("span");
    const label = document.createElement("span");
    button.type = "button";
    button.className = "nav-item";
    number.textContent = String(index + 1).padStart(2, "0");
    label.textContent = slide.dataset.title;
    button.append(number, label);
    button.addEventListener("click", () => {
      show(index);
      document.body.classList.remove("sidebar-open");
      button.blur();
    });
    item.appendChild(button);
    navList.appendChild(item);
    return button;
  });

  function directFragments(slide) {
    const fragments = [...slide.querySelectorAll(".fragment")];
    const topLevel = fragments.filter((fragment) => !fragment.parentElement.closest(".fragment"));
    const nested = fragments.filter((fragment) => !topLevel.includes(fragment));
    return [...topLevel, ...nested];
  }

  function updateFragDots() {
    fragDots.innerHTML = directFragments(slides[current])
      .map((fragment) => `<i${fragment.classList.contains("visible") ? ' class="done"' : ""}></i>`)
      .join("");
  }

  function updateNotes() {
    const notes = slides[current].querySelector("aside.notes");
    notesPanel.innerHTML = `<div class="notes-head"></div>${notes ? notes.innerHTML : "<p>노트 없음</p>"}`;
    notesPanel.firstElementChild.textContent = `${current + 1}. ${slides[current].dataset.title}`;
  }

  function show(index) {
    current = Math.max(0, Math.min(index, slides.length - 1));
    slides.forEach((slide, i) => slide.classList.toggle("active", i === current));
    navButtons.forEach((button, i) => button.classList.toggle("active", i === current));
    counter.textContent = `${current + 1} / ${slides.length}`;
    progressBar.style.width = `${((current + 1) / slides.length) * 100}%`;
    history.replaceState(null, "", `#slide-${current + 1}`);
    navButtons[current].scrollIntoView({ block: "nearest" });
    updateFragDots();
    updateNotes();
  }

  function revealNext() {
    const hidden = directFragments(slides[current]).find((fragment) => !fragment.classList.contains("visible"));
    if (!hidden) return false;
    hidden.classList.add("visible");
    updateFragDots();
    return true;
  }

  function hideLast() {
    const visible = directFragments(slides[current]).filter((fragment) => fragment.classList.contains("visible"));
    if (!visible.length) return false;
    visible[visible.length - 1].classList.remove("visible");
    updateFragDots();
    return true;
  }

  function next() {
    if (revealNext()) return;
    if (current < slides.length - 1) show(current + 1);
  }

  function prev() {
    if (hideLast()) return;
    if (current > 0) show(current - 1);
  }

  const toggleSidebar = () => document.body.classList.toggle("sidebar-open");
  const toggleNotes = () => document.body.classList.toggle("notes-open");
  const onButton = (selector, action) =>
    document.querySelector(selector).addEventListener("click", (event) => {
      action();
      event.currentTarget.blur();
    });
  onButton(".menu-button", toggleSidebar);
  onButton(".close-menu", toggleSidebar);
  onButton('[data-action="prev"]', prev);
  onButton('[data-action="next"]', next);

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft" || event.key === "PageUp" || event.key === "Backspace") {
      event.preventDefault();
      prev();
    } else if (event.code === "KeyM") {
      toggleSidebar();
    } else if (event.code === "KeyN") {
      toggleNotes();
    } else if (event.key === "Escape") {
      document.body.classList.remove("sidebar-open", "notes-open");
    }
  });

  deckEl.addEventListener("click", (event) => {
    if (event.target.closest("button, a")) return;
    next();
  });

  const hashMatch = location.hash.match(/slide-(\d+)/);
  show(hashMatch ? Number(hashMatch[1]) - 1 : 0);
  window.deck = {
    show,
    next,
    prev,
    get current() {
      return current;
    },
    count: slides.length,
  };
})();
