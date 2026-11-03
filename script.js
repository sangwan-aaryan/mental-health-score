(() => {
  "use strict";

  const isLocalFrontend = ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    window.location.port === "5500";
  const API_BASE = window.MENTAL_HEALTH_API_URL ||
    (isLocalFrontend
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : window.location.origin);
  const form = document.getElementById("predict-form");
  const submitBtn = document.getElementById("submit-btn");
  const stressGroup = document.getElementById("stress_level_group");
  const stressInput = document.getElementById("stress_level");
  const apiStatus = document.getElementById("api-status");
  const serviceIndicator = document.getElementById("service-indicator");
  const progressValue = document.getElementById("progress-value");
  const progressFill = document.getElementById("progress-fill");
  const stateIdle = document.getElementById("state-idle");
  const stateLoading = document.getElementById("state-loading");
  const stateResult = document.getElementById("state-result");
  const stateError = document.getElementById("state-error");
  const errorLabel = document.getElementById("error-label");
  const errorCopy = document.getElementById("error-copy");
  const scoreNumber = document.getElementById("score-number");
  const scoreBand = document.getElementById("score-band");
  const suggestionsList = document.getElementById("suggestions-list");
  const warningsList = document.getElementById("warnings-list");
  const warningsSection = document.getElementById("warnings-section");
  const routineList = document.getElementById("routine-list");

  const requiredFields = [
    "age", "gender", "country", "academic_level", "most_used_platform",
    "purpose_of_use", "avg_daily_usage_hours", "daily_unlocks", "study_hours",
    "physical_activity_hours", "sleep_hours_per_night",
  ];

  function showState(name) {
    const states = {
      idle: stateIdle,
      loading: stateLoading,
      result: stateResult,
      error: stateError,
    };
    Object.entries(states).forEach(([key, element]) => {
      element.hidden = key !== name;
    });
  }

  function setFieldError(input, message) {
    const wrapper = input.closest(".field");
    if (!wrapper) return;
    wrapper.classList.add("field-error");
    const error = wrapper.querySelector(".error-msg");
    if (error) error.textContent = message;
  }

  function clearFieldError(input) {
    const wrapper = input.closest(".field");
    if (!wrapper) return;
    wrapper.classList.remove("field-error");
    const error = wrapper.querySelector(".error-msg");
    if (error) error.textContent = "";
  }

  function clearErrors() {
    form.querySelectorAll(".field").forEach((field) => {
      field.classList.remove("field-error");
    });
    form.querySelectorAll(".error-msg").forEach((error) => {
      error.textContent = "";
    });
  }

  function collectPayload() {
    const formData = new FormData(form);
    const number = (name) => {
      const value = formData.get(name);
      return value === "" || value === null ? Number.NaN : Number(value);
    };
    return {
      age: number("age"),
      gender: formData.get("gender") || "",
      country: String(formData.get("country") || "").trim(),
      academic_level: formData.get("academic_level") || "",
      most_used_platform: formData.get("most_used_platform") || "",
      purpose_of_use: formData.get("purpose_of_use") || "",
      avg_daily_usage_hours: number("avg_daily_usage_hours"),
      daily_unlocks: number("daily_unlocks"),
      study_hours: number("study_hours"),
      physical_activity_hours: number("physical_activity_hours"),
      sleep_hours_per_night: number("sleep_hours_per_night"),
      stress_level: formData.get("stress_level") || "",
    };
  }

  function validate(payload) {
    const errors = [];
    const numericChecks = [
      ["age", 10, 100, true],
      ["avg_daily_usage_hours", 0, 24, false],
      ["daily_unlocks", 0, Infinity, true],
      ["study_hours", 0, 24, false],
      ["physical_activity_hours", 0, 24, false],
      ["sleep_hours_per_night", 0, 24, false],
    ];

    numericChecks.forEach(([key, minimum, maximum, integer]) => {
      const input = document.getElementById(key);
      const value = payload[key];
      if (!Number.isFinite(value)) {
        errors.push([input, "Enter a valid number."]);
      } else if (value < minimum || value > maximum) {
        errors.push([input, `Enter a value between ${minimum} and ${maximum === Infinity ? "any non-negative number" : maximum}.`]);
      } else if (integer && !Number.isInteger(value)) {
        errors.push([input, "Enter a whole number."]);
      }
    });

    ["gender", "academic_level", "most_used_platform", "purpose_of_use"].forEach((key) => {
      const input = document.getElementById(key);
      if (!payload[key]) errors.push([input, "Choose an option to continue."]);
    });

    const countryInput = document.getElementById("country");
    if (payload.country.length < 2) {
      errors.push([countryInput, "Enter a country name (at least 2 characters)."]);
    }

    if (!payload.stress_level) {
      errors.push([stressInput, "Choose the stress level that feels closest."]);
    }
    return errors;
  }

  function updateProgress() {
    const completeFields = requiredFields.reduce((count, name) => {
      const input = document.getElementById(name);
      return count + (String(input.value).trim() ? 1 : 0);
    }, stressInput.value ? 1 : 0);
    const percent = Math.round((completeFields / (requiredFields.length + 1)) * 100);
    progressValue.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;
    progressFill.parentElement.setAttribute("aria-valuenow", String(percent));
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("loading", isLoading);
    submitBtn.querySelector(".btn-label").textContent = isLoading
      ? "Creating your snapshot…"
      : "Get my snapshot";
  }

  function renderList(list, entries) {
    list.replaceChildren();
    entries.forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = entry;
      list.appendChild(item);
    });
  }

  function renderRoutine(payload) {
    const measures = [
      { key: "sleep_hours_per_night", label: "Sleep", suffix: "hrs", maximum: 9.9 },
      { key: "avg_daily_usage_hours", label: "Screen time", suffix: "hrs", maximum: 8.8 },
      { key: "study_hours", label: "Study", suffix: "hrs", maximum: 8.3 },
      { key: "physical_activity_hours", label: "Movement", suffix: "hrs", maximum: 4.1 },
      { key: "daily_unlocks", label: "Phone unlocks", suffix: " / day", maximum: 273 },
    ];
    routineList.replaceChildren();
    measures.forEach(({ key, label, suffix, maximum }) => {
      const item = document.createElement("li");
      const labelRow = document.createElement("div");
      labelRow.className = "routine-label";
      const name = document.createElement("span");
      name.textContent = label;
      const value = document.createElement("strong");
      value.textContent = `${payload[key]}${suffix}`;
      labelRow.append(name, value);

      const track = document.createElement("div");
      track.className = "routine-track";
      track.setAttribute("aria-label", `${label}: ${payload[key]}${suffix}`);
      const fill = document.createElement("span");
      fill.style.width = `${Math.min(100, (payload[key] / maximum) * 100)}%`;
      track.appendChild(fill);
      item.append(labelRow, track);
      routineList.appendChild(item);
    });
  }

  function renderResult(data, payload) {
    const score = data.predicted_mental_health_score;
    if (typeof score !== "number" || !Number.isFinite(score)) {
      throw new Error("The prediction service returned an invalid score.");
    }
    scoreNumber.textContent = score.toFixed(2);
    scoreBand.textContent = data.interpretation || "Model estimate from survey patterns";
    renderList(suggestionsList, Array.isArray(data.suggestions) ? data.suggestions : []);
    renderList(warningsList, Array.isArray(data.data_warnings) ? data.data_warnings : []);
    warningsSection.hidden = !data.data_warnings?.length;
    renderRoutine(payload);
    showState("result");
  }

  function applyServerErrors(detail) {
    if (!Array.isArray(detail)) return false;
    let matched = false;
    detail.forEach((error) => {
      const field = Array.isArray(error.loc) ? error.loc[error.loc.length - 1] : null;
      const input = field === "stress_level"
        ? stressInput
        : (field ? document.getElementById(field) : null);
      if (input) {
        setFieldError(input, error.msg || "Please check this value.");
        matched = true;
      }
    });
    return matched;
  }

  function setStressLevel(value) {
    stressInput.value = value;
    stressGroup.querySelectorAll(".stress-option").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.value === value));
    });
    clearFieldError(stressInput);
    updateProgress();
  }

  stressGroup.querySelectorAll(".stress-option").forEach((button) => {
    button.addEventListener("click", () => setStressLevel(button.dataset.value));
  });

  form.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", () => {
      clearFieldError(input);
      updateProgress();
    });
    input.addEventListener("change", () => {
      clearFieldError(input);
      updateProgress();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    const payload = collectPayload();
    const errors = validate(payload);
    if (errors.length) {
      errors.forEach(([input, message]) => setFieldError(input, message));
      const firstInvalid = errors[0][0];
      (firstInvalid === stressInput
        ? stressGroup.querySelector(".stress-option")
        : firstInvalid).focus();
      return;
    }

    setLoading(true);
    showState("loading");
    try {
      const response = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (response.status === 422) {
        const matched = applyServerErrors(body.detail);
        errorLabel.textContent = "A quick check";
        errorCopy.textContent = matched
          ? "We marked the fields that need another look."
          : "Please review your answers and try again.";
        showState("error");
        return;
      }
      if (!response.ok) {
        const message = typeof body.detail === "string"
          ? body.detail
          : `The service responded with status ${response.status}.`;
        throw new Error(message);
      }
      renderResult(body, payload);
    } catch (error) {
      errorLabel.textContent = error instanceof TypeError
        ? "Can’t reach the check-in service"
        : "Your snapshot couldn’t be created";
      errorCopy.textContent = error instanceof TypeError
        ? `Please check your connection and start the API at ${API_BASE}.`
        : error.message;
      showState("error");
    } finally {
      setLoading(false);
    }
  });

  function resetCheckin() {
    form.reset();
    setStressLevel("");
    clearErrors();
    updateProgress();
    showState("idle");
  }

  document.getElementById("sample-btn").addEventListener("click", () => {
    const example = {
      age: 21,
      gender: "Female",
      country: "India",
      academic_level: "Undergraduate",
      most_used_platform: "Instagram",
      purpose_of_use: "Education",
      avg_daily_usage_hours: 5,
      daily_unlocks: 171,
      study_hours: 3,
      physical_activity_hours: 1.5,
      sleep_hours_per_night: 7,
    };
    Object.entries(example).forEach(([name, value]) => {
      document.getElementById(name).value = String(value);
    });
    setStressLevel("Medium");
    clearErrors();
    updateProgress();
    document.getElementById("age").focus();
  });

  document.getElementById("clear-btn").addEventListener("click", resetCheckin);
  document.getElementById("reset-btn").addEventListener("click", resetCheckin);
  document.getElementById("error-retry-btn").addEventListener("click", () => showState("idle"));
  document.getElementById("print-btn").addEventListener("click", () => window.print());

  const themeToggle = document.getElementById("theme-toggle");
  const themeColor = document.querySelector('meta[name="theme-color"]');

  function applyTheme(isDark) {
    document.body.classList.toggle("dark-theme", isDark);
    themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "day" : "night"} theme`);
    themeToggle.title = `Switch to ${isDark ? "day" : "night"} theme`;
    themeColor.content = isDark ? "#17231f" : "#f8f7f0";
  }

  try {
    const savedTheme = window.localStorage.getItem("mindful-theme");
    applyTheme(savedTheme === null ? true : savedTheme === "night");
  } catch {
    applyTheme(true);
  }

  themeToggle.addEventListener("click", () => {
    const isDark = !document.body.classList.contains("dark-theme");
    applyTheme(isDark);
    try {
      window.localStorage.setItem("mindful-theme", isDark ? "night" : "day");
    } catch {
      // Theme still changes for this page view when storage is unavailable.
    }
  });

  const progressTrack = document.querySelector(".progress-track");
  progressTrack.setAttribute("role", "progressbar");
  progressTrack.setAttribute("aria-label", "Check-in completion");
  progressTrack.setAttribute("aria-valuemin", "0");
  progressTrack.setAttribute("aria-valuemax", "100");
  updateProgress();

  fetch(`${API_BASE}/health`)
    .then((response) => {
      if (!response.ok) throw new Error(`Health check returned ${response.status}`);
      return response.json();
    })
    .then((status) => {
      if (!status.model_loaded) throw new Error("The prediction model is unavailable.");
      apiStatus.textContent = "Check-in service is ready";
      serviceIndicator.classList.add("service-ready");
    })
    .catch(() => {
      apiStatus.textContent = "Check-in service unavailable · please try again later";
      serviceIndicator.classList.add("service-error");
    });
})();
