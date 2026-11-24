const STORAGE_KEY = "campusDeskRequest";
const CLEARANCE_NAMES = ["Library Dues", "Hostel Dues", "Accounts Clearance"];
const STATUS_NAMES = ["Submitted", "Dean Approved", "Certificate Ready"];
const STATUS_CLASSES = ["submitted", "approved", "ready"];
const form = document.querySelector("#request-form");
const clearanceInputs = [...document.querySelectorAll('input[name="clearance"]')];
const toast = document.querySelector("#toast");

let toastTimeout;
let state = {
  totalRequests: 0,
  request: null,
  clearances: [],
};

function showToast(message, isError = false) {
  window.clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3600);
}

function persistState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    showToast("Your browser could not save this update. It will be lost when you leave this page.", true);
    return false;
  }
}

function readSavedState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") throw new Error("Saved request data is not an object.");

    state.totalRequests = Number.isInteger(parsed.totalRequests) && parsed.totalRequests >= 0
      ? parsed.totalRequests
      : 0;
    state.clearances = Array.isArray(parsed.clearances)
      ? CLEARANCE_NAMES.filter((name) => parsed.clearances.includes(name))
      : [];

    const request = parsed.request;
    if (
      request &&
      typeof request === "object" &&
      typeof request.certificateType === "string" &&
      typeof request.purpose === "string" &&
      typeof request.rollNumber === "string" &&
      Number.isInteger(request.status) &&
      request.status >= 0 &&
      request.status < STATUS_NAMES.length &&
      Array.isArray(request.statusDates)
    ) {
      state.request = {
        certificateType: request.certificateType,
        purpose: request.purpose,
        organization: typeof request.organization === "string" ? request.organization : "",
        rollNumber: request.rollNumber,
        id: typeof request.id === "string" ? request.id : "—",
        submittedAt: typeof request.submittedAt === "string" ? request.submittedAt : new Date().toISOString(),
        status: request.status,
        statusDates: request.statusDates.slice(0, STATUS_NAMES.length).map((date) => (
          typeof date === "string" ? date : ""
        )),
      };
    }
  } catch (error) {
    showToast("Saved request data could not be read. You can start a new request.", true);
    state = { totalRequests: 0, request: null, clearances: [] };
  }
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function renderClearances() {
  let clearedCount = 0;

  clearanceInputs.forEach((input) => {
    const isCleared = state.clearances.includes(input.value);
    const item = input.closest(".clearance-item");
    input.checked = isCleared;
    item.classList.toggle("is-cleared", isCleared);
    item.querySelector(".clearance-status").textContent = isCleared ? "Cleared" : "Pending";
    if (isCleared) clearedCount += 1;
  });

  document.querySelector("#clearance-count").textContent = `${clearedCount} of ${CLEARANCE_NAMES.length}`;
  document.querySelector("#clearance-progress").style.width = `${(clearedCount / CLEARANCE_NAMES.length) * 100}%`;
  document.querySelector(".progress-track").setAttribute("aria-valuenow", String(clearedCount));

  const message = clearedCount === CLEARANCE_NAMES.length
    ? "All departments are clear. Your request can move to certificate preparation."
    : "Tick a department once you’ve confirmed your dues are clear.";
  document.querySelector("#clearance-message").textContent = message;
  renderStatus();
}

function renderStatus() {
  const request = state.request;
  const statusElement = document.querySelector("#current-status");
  const advanceButton = document.querySelector("#advance-status");
  const hint = document.querySelector("#tracker-hint");
  const timelineSteps = [...document.querySelectorAll(".timeline-step")];

  document.querySelector("#total-requests").textContent = String(state.totalRequests);
  document.querySelector("#nav-count").textContent = String(state.totalRequests);
  document.querySelector("#in-progress").textContent = request && request.status < 2 ? "1" : "0";
  document.querySelector("#ready-count").textContent = request && request.status === 2 ? "1" : "0";

  timelineSteps.forEach((step, index) => {
    step.classList.toggle("is-complete", Boolean(request) && index <= request.status);
    step.classList.toggle("is-current", Boolean(request) && index === request.status + 1);
    step.querySelector(".timeline-date").textContent = request?.statusDates[index]
      ? formatDate(new Date(request.statusDates[index]))
      : "—";
  });

  if (!request) {
    statusElement.textContent = "No active request";
    statusElement.className = "status-pill empty";
    document.querySelector("#tracker-description").textContent = "Your latest request will show up here once submitted.";
    document.querySelector("#preview-title").textContent = "No request submitted yet";
    document.querySelector("#preview-meta").textContent = "Your application details will appear here";
    document.querySelector("#preview-id").textContent = "—";
    document.querySelector("#submitted-date").textContent = "—";
    advanceButton.disabled = true;
    document.querySelector("#advance-label").textContent = "Next status";
    hint.textContent = "Submit a request to begin tracking.";
    return;
  }

  statusElement.textContent = STATUS_NAMES[request.status];
  statusElement.className = `status-pill ${STATUS_CLASSES[request.status]}`;
  document.querySelector("#tracker-description").textContent = `Follow your ${request.certificateType.toLowerCase()} from submission to collection.`;
  document.querySelector("#preview-title").textContent = request.certificateType;
  document.querySelector("#preview-meta").textContent = `${request.purpose} · ${request.rollNumber}`;
  document.querySelector("#preview-id").textContent = request.id;
  document.querySelector("#submitted-date").textContent = formatDate(new Date(request.submittedAt));

  const allClear = state.clearances.length === CLEARANCE_NAMES.length;
  advanceButton.disabled = request.status === 2 || (request.status === 1 && !allClear);
  document.querySelector("#advance-label").textContent = request.status === 0
    ? "Simulate dean approval"
    : request.status === 1
      ? "Mark certificate ready"
      : "Certificate ready";

  if (request.status === 0) {
    hint.textContent = "Next, simulate the Dean’s review approval.";
  } else if (request.status === 1 && !allClear) {
    hint.textContent = "Clear all three departments before the certificate is ready.";
  } else if (request.status === 1) {
    hint.textContent = "All clearances are complete. Your certificate can be prepared.";
  } else {
    hint.textContent = "Your certificate is ready for collection.";
  }
}

function createRequestId() {
  const datePart = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CD-${datePart}-${randomPart}`;
}

function handleSubmit(event) {
  event.preventDefault();
  const purposeInput = document.querySelector("#purpose");
  const rollNumberInput = document.querySelector("#roll-number");
  purposeInput.setCustomValidity(purposeInput.value.trim() ? "" : "Enter the purpose of your request.");
  rollNumberInput.setCustomValidity(rollNumberInput.value.trim() ? "" : "Enter your roll number.");
  if (!form.reportValidity()) return;

  const formData = new FormData(form);
  const submittedAt = new Date().toISOString();
  state.request = {
    certificateType: String(formData.get("certificateType")),
    purpose: String(formData.get("purpose")).trim(),
    organization: String(formData.get("organization")).trim(),
    rollNumber: String(formData.get("rollNumber")).trim(),
    id: createRequestId(),
    submittedAt,
    status: 0,
    statusDates: [submittedAt, "", ""],
  };
  state.totalRequests += 1;
  const saved = persistState();
  renderStatus();
  if (saved) showToast("Your request has been submitted and is now being tracked.");
  document.querySelector("#request-tracker").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function handleAdvanceStatus() {
  if (!state.request || state.request.status >= STATUS_NAMES.length - 1) return;
  if (state.request.status === 1 && state.clearances.length !== CLEARANCE_NAMES.length) {
    showToast("Please complete all department clearances before marking the certificate ready.", true);
    return;
  }

  state.request.status += 1;
  state.request.statusDates[state.request.status] = new Date().toISOString();
  const saved = persistState();
  renderStatus();
  if (saved) showToast(`Status updated: ${STATUS_NAMES[state.request.status]}.`);
}

form.addEventListener("submit", handleSubmit);
document.querySelector("#advance-status").addEventListener("click", handleAdvanceStatus);

clearanceInputs.forEach((input) => {
  input.addEventListener("change", () => {
    state.clearances = clearanceInputs
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);
    persistState();
    renderClearances();
  });
});

const now = new Date();
const month = now.getMonth();
const semester = month >= 7 && month <= 11
  ? "Fall"
  : month >= 0 && month <= 4
    ? "Spring"
    : "Summer";
document.querySelector("#semester-label").textContent = `${semester} semester ${now.getFullYear()}`;
document.querySelector("#current-year").textContent = String(now.getFullYear());
document.querySelector("#today-date").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(now);

readSavedState();
renderClearances();
