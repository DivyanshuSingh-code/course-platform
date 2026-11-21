let isSignUp = false;
let currentUser = null;

const authModal = document.getElementById("auth-modal");
const authForm = document.getElementById("auth-form");
const authError = document.getElementById("auth-error");
const courseGrid = document.getElementById("course-grid");
const statusBanner = document.getElementById("status-banner");
const lessonViewer = document.getElementById("lesson-viewer");

function showBanner(message) {
  statusBanner.textContent = message;
  statusBanner.classList.remove("hidden");
}

function clearBanner() {
  statusBanner.textContent = "";
  statusBanner.classList.add("hidden");
}

function saveSession(user) {
  currentUser = user;
  if (user) {
    localStorage.setItem("session", JSON.stringify(user));
  } else {
    localStorage.removeItem("session");
  }
}

function handleExpiredSession(message = "Your session expired. Please sign in again.") {
  saveSession(null);
  lessonViewer.classList.add("hidden");
  renderNavbar();
  loadCourses();
  showBanner(message);
  openModal();
}

function openModal() {
  authError.textContent = "";
  authModal.classList.remove("hidden");
  document.getElementById("email").focus();
}

function closeModal() {
  authModal.classList.add("hidden");
  authForm.reset();
  authError.textContent = "";
}

try {
  const saved = localStorage.getItem("session");
  if (saved) {
    currentUser = JSON.parse(saved);
  }
} catch {
  localStorage.removeItem("session");
}

document.getElementById("toggle-auth-mode").addEventListener("click", (e) => {
  e.preventDefault();
  isSignUp = !isSignUp;
  document.getElementById("auth-title").textContent = isSignUp ? "Create Account" : "Sign In";
  document.getElementById("auth-switch-label").textContent = isSignUp
    ? "Already have an account?"
    : "Don't have an account?";
  e.target.textContent = isSignUp ? "Sign In" : "Sign Up";
  document.getElementById("password").setAttribute(
    "autocomplete",
    isSignUp ? "new-password" : "current-password"
  );
  authError.textContent = "";
});

document.getElementById("close-auth-btn").addEventListener("click", closeModal);

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const endpoint = isSignUp ? "/api/signup" : "/api/login";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      authError.textContent = data.error || "Authentication failed";
      return;
    }

    saveSession(data);
    closeModal();
    clearBanner();
    renderNavbar();
    loadCourses();
  } catch {
    authError.textContent = "Network error. Check if the server is running.";
  }
});

function logout() {
  saveSession(null);
  lessonViewer.classList.add("hidden");
  clearBanner();
  renderNavbar();
  loadCourses();
}

function renderNavbar() {
  const container = document.getElementById("auth-controls");
  if (!currentUser) {
    container.innerHTML = `<button id="open-auth-btn" type="button" class="btn btn-primary">Sign In / Sign Up</button>`;
    document.getElementById("open-auth-btn").addEventListener("click", openModal);
    return;
  }

  const userSpan = document.createElement("span");
  userSpan.textContent = currentUser.email;
  userSpan.style.marginRight = "12px";
  userSpan.style.fontSize = "0.9rem";

  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "btn btn-ghost";
  logoutBtn.textContent = "Sign Out";
  logoutBtn.addEventListener("click", logout);

  container.replaceChildren(userSpan, logoutBtn);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadCourses() {
  try {
    const res = await fetch("/api/courses");
    const courses = await res.json();
    if (!res.ok) {
      showBanner(courses.error || "Failed to load courses.");
      return;
    }

    const enrolled = Array.isArray(currentUser?.enrolledCourseIds)
      ? currentUser.enrolledCourseIds
      : [];

    courseGrid.innerHTML = courses
      .map((course) => {
        const owned = enrolled.includes(course.id);
        return `
          <div class="card">
            <h3>${escapeHtml(course.title)}</h3>
            <p>${escapeHtml(course.description)}</p>
            <div class="price">₹${Number(course.price)}</div>
            ${
              owned
                ? `<button type="button" class="btn btn-success" data-action="learn" data-course-id="${escapeHtml(course.id)}">Start Learning</button>`
                : `<button type="button" class="btn btn-primary" data-action="buy" data-course-id="${escapeHtml(course.id)}">Buy Course</button>`
            }
          </div>
        `;
      })
      .join("");
  } catch {
    showBanner("Could not reach the server. Start it with: npm start");
  }
}

courseGrid.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const courseId = btn.dataset.courseId;
  if (action === "buy") {
    await buyCourse(courseId);
  } else if (action === "learn") {
    await openCourse(courseId);
  }
});

async function buyCourse(courseId) {
  if (!currentUser) {
    openModal();
    return;
  }

  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.token}`
      },
      body: JSON.stringify({ courseId })
    });

    if (res.status === 401) {
      handleExpiredSession();
      return;
    }

    const order = await res.json();
    if (!res.ok) {
      showBanner(order.error || "Could not start checkout.");
      return;
    }

    const confirmed = window.confirm(
      `Confirm simulated payment of ₹${order.amount} for "${order.courseTitle}"?`
    );
    if (!confirmed) return;

    const verifyRes = await fetch("/api/confirm-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.token}`
      },
      body: JSON.stringify({ orderId: order.orderId })
    });

    if (verifyRes.status === 401) {
      handleExpiredSession();
      return;
    }

    const updated = await verifyRes.json();
    if (!verifyRes.ok) {
      showBanner(updated.error || "Payment verification failed.");
      return;
    }

    saveSession({
      ...currentUser,
      enrolledCourseIds: updated.enrolledCourseIds
    });
    showBanner(`Enrolled in "${order.courseTitle}". Click Start Learning to view lessons.`);
    loadCourses();
  } catch {
    showBanner("Network error during checkout.");
  }
}

async function openCourse(courseId) {
  if (!currentUser) {
    openModal();
    return;
  }

  try {
    const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/lesson`, {
      headers: { Authorization: `Bearer ${currentUser.token}` }
    });

    if (res.status === 401) {
      handleExpiredSession();
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      showBanner(data.error || "Unable to open lesson.");
      return;
    }

    clearBanner();
    document.getElementById("lesson-title").textContent = data.title;
    document.getElementById("lesson-content").textContent = data.content;
    lessonViewer.classList.remove("hidden");
    lessonViewer.scrollIntoView({ behavior: "smooth" });
  } catch {
    showBanner("Network error loading lesson content.");
  }
}

renderNavbar();
loadCourses();