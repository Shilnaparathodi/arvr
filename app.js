/* FireSafe VR — minimal, self-contained training logic (no build step).
   Works by opening index.html in a modern browser. */

const $ = (id) => document.getElementById(id);

const state = {
  running: false,
  startedAtMs: 0,
  durationSec: 60,
  timeLeftSec: 60,
  score: 0,
  fireIntensity: 1.0, // 0..1
  smokeLevel: 0.0, // 0..1
  extinguisher: {
    picked: false,
    pinPulled: false,
    aiming: false,
    spraying: false,
    sweep: 0,
  },
  exit: {
    safeId: "exitMain",
    blockedId: null,
  },
  quiz: {
    idx: 0,
    correct: 0,
  },
};

const quizQuestions = [
  {
    q: "When the fire alarm rings, what should you do first?",
    options: [
      "Ignore it and finish your work",
      "Evacuate immediately using the nearest safe exit",
      "Use the elevator to leave quickly",
    ],
    correct: 1,
    explain: "Treat alarms seriously: evacuate using the nearest safe exit (no elevators).",
  },
  {
    q: "Which part of the fire should you aim at with an extinguisher?",
    options: ["The top of the flames", "The base of the fire", "The smoke layer"],
    correct: 1,
    explain: "Aim at the base where the fuel is burning.",
  },
  {
    q: "If smoke is thick, the safest way to move is…",
    options: ["Stand tall to see better", "Crawl low under the smoke", "Run and breathe fast"],
    correct: 1,
    explain: "Smoke rises—cleaner air is near the floor, so stay low.",
  },
];

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function show(id) {
  const el = $(id);
  if (el) el.classList.remove("hidden");
}

function hide(id) {
  const el = $(id);
  if (el) el.classList.add("hidden");
}

function setStatus(text, tone = "neutral") {
  setText("statusText", text);
  const el = $("statusText");
  if (!el) return;
  el.style.color =
    tone === "good" ? "#3cff71" : tone === "warn" ? "#ffcc66" : tone === "bad" ? "#ff4d4d" : "";
}

function setSmokeRisk(text, tone = "neutral") {
  setText("smokeRisk", text);
  const el = $("smokeRisk");
  if (!el) return;
  el.style.color =
    tone === "good" ? "#3cff71" : tone === "warn" ? "#ffcc66" : tone === "bad" ? "#ff4d4d" : "";
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function nowMs() {
  return performance.now();
}

function setExitScenario() {
  // Single safe exit gate
  state.exit.safeId = "exitMain";
  state.exit.blockedId = null;
  const safe = document.querySelector("#exitMain a-box");
  if (safe) safe.setAttribute("color", "#2a7a3b");
  const arrow1 = document.querySelector("#arrow1");
  if (arrow1) arrow1.setAttribute("value", "⬆ EXIT");
}

function updateFireAndSmoke(dtSec) {
  // If simulation is running, fire grows slowly; if sprayed correctly, it shrinks.
  const growth = 0.016 * dtSec; // slow growth
  const smokeGrowth = 0.03 * dtSec;

  const sprayEffect = state.extinguisher.spraying && state.extinguisher.aiming ? 0.18 * dtSec : 0;

  state.fireIntensity = clamp01(state.fireIntensity + growth - sprayEffect);
  // Smoke follows fire but lags, plus rises over time.
  state.smokeLevel = clamp01(state.smokeLevel + smokeGrowth * (0.4 + state.fireIntensity) - sprayEffect * 0.35);

  // Apply to scene visuals
  const fire = document.querySelector("#fire");
  if (fire) fire.setAttribute("scale", `${0.7 + state.fireIntensity * 0.9} ${0.7 + state.fireIntensity * 0.9} ${0.7 + state.fireIntensity * 0.9}`);

  const smokeTop = document.querySelector("#smokeTop");
  const smokeMid = document.querySelector("#smokeMid");
  if (smokeTop) smokeTop.setAttribute("material", "opacity", (0.05 + state.smokeLevel * 0.55).toFixed(3));
  if (smokeMid) smokeMid.setAttribute("material", "opacity", (0.03 + state.smokeLevel * 0.35).toFixed(3));

  // Alarm light intensity scales with fire intensity when running
  const alarmLight = document.querySelector("#alarmLight");
  if (alarmLight) alarmLight.setAttribute("light", "intensity", state.running ? 0.6 + state.fireIntensity * 1.4 : 0);
}

function updateTimer() {
  if (!state.running) return;
  const elapsedSec = Math.floor((nowMs() - state.startedAtMs) / 1000);
  const left = Math.max(0, state.durationSec - elapsedSec);
  state.timeLeftSec = left;
  setText("timeLeft", String(left));
  if (left === 0) endSimulation(false, "Time is up. In a real emergency, speed matters — move quickly and follow exit signage.");
}

function endSimulation(success, message) {
  if (!state.running) return;
  state.running = false;

  // Score: time bonus + extinguisher bonus if fire reduced significantly
  const timeSpent = state.durationSec - state.timeLeftSec;
  const timeBonus = Math.max(0, 60 - timeSpent);
  const fireBonus = state.fireIntensity < 0.35 ? 25 : state.fireIntensity < 0.6 ? 10 : 0;
  const smokePenalty = state.smokeLevel > 0.7 ? 15 : state.smokeLevel > 0.5 ? 7 : 0;
  state.score = Math.max(0, timeBonus + fireBonus - smokePenalty);

  hide("passCard");
  hide("startCard");
  hide("tipsCard");
  hide("quizCard");
  show("resultCard");

  const title = success ? "Simulation complete" : "Simulation ended";
  const extra = `Score: ${state.score} (time bonus + extinguisher bonus − smoke penalty)`;
  $("resultBody").innerHTML = `<div style="margin-bottom:10px;color:rgba(234,240,255,0.82)"><b>${title}</b></div>
    <div style="margin-bottom:10px;color:rgba(234,240,255,0.75)">${message}</div>
    <div style="color:rgba(234,240,255,0.75)">${extra}</div>`;

  setStatus(success ? "Completed" : "Ended", success ? "good" : "warn");
  setSmokeRisk("—", "neutral");

  // Stop flashing alarm
  const alarmLight = document.querySelector("#alarmLight");
  if (alarmLight) alarmLight.setAttribute("light", "intensity", 0);
}

function resetSimulation() {
  state.running = false;
  state.startedAtMs = 0;
  state.timeLeftSec = state.durationSec;
  state.score = 0;
  state.fireIntensity = 1.0;
  state.smokeLevel = 0.0;
  state.extinguisher = { picked: false, pinPulled: false, aiming: false, spraying: false, sweep: 0 };
  state.quiz = { idx: 0, correct: 0 };

  setText("timeLeft", String(state.durationSec));
  setStatus("Ready");
  setSmokeRisk("Low", "good");

  // Reset visuals
  const smokeTop = document.querySelector("#smokeTop");
  const smokeMid = document.querySelector("#smokeMid");
  if (smokeTop) smokeTop.setAttribute("material", "opacity", 0.0);
  if (smokeMid) smokeMid.setAttribute("material", "opacity", 0.0);

  const fire = document.querySelector("#fire");
  if (fire) fire.setAttribute("scale", "1 1 1");

  // Reset exit gate
  const exitBox = document.querySelector("#exitMain a-box");
  if (exitBox) exitBox.setAttribute("color", "#2a7a3b");

  // Reset extinguisher position
  const ext = document.querySelector("#extinguisher");
  if (ext) {
    ext.setAttribute("position", "-4 0.1 -0.6");
    ext.setAttribute("rotation", "0 90 0");
  }

  hide("resultCard");
  hide("deadCard");
  hide("tipsCard");
  hide("quizCard");
  hide("passCard");
  show("startCard");
}

function startSimulation() {
  resetSimulation();
  setExitScenario();

  state.running = true;
  state.startedAtMs = nowMs();
  setStatus("Evacuate — follow EXIT signage", "warn");
  hide("startCard");

  // Turn on alarm visuals + message
  const alarmLight = document.querySelector("#alarmLight");
  if (alarmLight) {
    alarmLight.setAttribute("light", "intensity", 1.2);
    // pulse via built-in animation
    alarmLight.setAttribute(
      "animation__pulse",
      "property: light.intensity; dir: alternate; dur: 350; easing: easeInOutSine; loop: true; from: 0.6; to: 2.2"
    );
  }
}

function killPlayer(reason = "You got too close to the flames — in real life, heat and smoke are deadly.") {
  if (!state.running) return;
  state.running = false;
  hide("passCard");
  hide("tipsCard");
  hide("quizCard");
  hide("startCard");
  hide("resultCard");
  show("deadCard");
  $("deadBody").innerHTML = `<div style="margin-bottom:10px;color:rgba(234,240,255,0.75)">${reason}</div>`;
  setStatus("You were overcome by the fire", "bad");
  setSmokeRisk("—", "neutral");
  const alarmLight = document.querySelector("#alarmLight");
  if (alarmLight) alarmLight.setAttribute("light", "intensity", 0);
}

function showTips() {
  hide("startCard");
  hide("quizCard");
  hide("resultCard");
  hide("passCard");
  show("tipsCard");
}

function showQuiz() {
  hide("startCard");
  hide("tipsCard");
  hide("resultCard");
  hide("passCard");
  show("quizCard");
  renderQuiz();
}

function renderQuiz() {
  const item = quizQuestions[state.quiz.idx];
  if (!item) {
    hide("quizCard");
    show("resultCard");
    $("resultBody").innerHTML = `<div style="margin-bottom:10px;color:rgba(234,240,255,0.82)"><b>Quiz complete</b></div>
    <div style="color:rgba(234,240,255,0.75)">You got <b>${state.quiz.correct}</b> / <b>${quizQuestions.length}</b> correct.</div>`;
    return;
  }
  $("quizBody").innerHTML = `<div style="margin-bottom:10px"><b>Q${state.quiz.idx + 1}.</b> ${item.q}</div>`;
  $("btnQuizA").textContent = item.options[0];
  $("btnQuizB").textContent = item.options[1];
  $("btnQuizC").textContent = item.options[2];
}

function answerQuiz(choiceIdx) {
  const item = quizQuestions[state.quiz.idx];
  if (!item) return;
  const correct = choiceIdx === item.correct;
  if (correct) state.quiz.correct += 1;
  $("quizBody").innerHTML = `<div style="margin-bottom:10px"><b>${correct ? "Correct" : "Not quite"}</b></div>
    <div style="color:rgba(234,240,255,0.75)">${item.explain}</div>`;
  $("btnQuizA").disabled = true;
  $("btnQuizB").disabled = true;
  $("btnQuizC").disabled = true;

  setTimeout(() => {
    $("btnQuizA").disabled = false;
    $("btnQuizB").disabled = false;
    $("btnQuizC").disabled = false;
    state.quiz.idx += 1;
    renderQuiz();
  }, 900);
}

// ---------------- A-Frame Components ----------------

AFRAME.registerComponent("fire-behavior", {
  schema: { secondary: { type: "boolean", default: false } },
  init() {
    this.baseScale = this.el.object3D.scale.clone();
    this.t = 0;
  },
  tick(_, dt) {
    const dtSec = (dt || 0) / 1000;
    this.t += dtSec;
    const pulse = 1 + Math.sin(this.t * (this.data.secondary ? 7.5 : 6.0)) * (this.data.secondary ? 0.06 : 0.09);
    const intensity = 0.65 + state.fireIntensity * 0.9;
    this.el.object3D.scale.set(
      this.baseScale.x * intensity * pulse,
      this.baseScale.y * intensity * pulse,
      this.baseScale.z * intensity * pulse
    );
  },
});

AFRAME.registerComponent("smoke-layer", {
  schema: { band: { type: "string", default: "mid" } },
  init() {
    // Gentle drift using animation
    const speed = this.data.band === "top" ? 2200 : 2600;
    this.el.setAttribute(
      "animation__drift",
      `property: position; dir: alternate; dur: ${speed}; easing: easeInOutSine; loop: true; to: 0.15 ${this.el.getAttribute("position").y} 0.18`
    );
  },
});

AFRAME.registerComponent("exit-guidance", {
  init() {
    // Flash arrows a bit to feel like guidance lights
    const a1 = this.el.querySelector("#arrow1");
    const a2 = this.el.querySelector("#arrow2");
    if (a1) a1.setAttribute("animation__flash", "property: material.opacity; dir: alternate; dur: 600; loop: true; from: 0.35; to: 1.0");
    if (a2) a2.setAttribute("animation__flash", "property: material.opacity; dir: alternate; dur: 650; loop: true; from: 0.35; to: 1.0");
  },
});

AFRAME.registerComponent("exit-door", {
  schema: { name: { type: "string", default: "Exit" } },
  init() {
    this.el.addEventListener("click", () => {
      if (!state.running) return;
      const id = this.el.getAttribute("id");
      if (id === state.exit.safeId) {
        endSimulation(true, "You found a safe exit and evacuated. Great job following exit guidance.");
      }
    });
  },
});

AFRAME.registerComponent("extinguisher", {
  init() {
    this.rig = document.querySelector("#rig");
    this.camera = document.querySelector("#camera");
    this.cursor = document.querySelector("#cursor");
    this.fireEl = document.querySelector("#fire");
    this.sprayCone = null;

    // Clicking the invisible click tag picks up the extinguisher
    const clickTag = document.querySelector("#extClick");
    if (clickTag) {
      clickTag.addEventListener("click", () => this.pickUp());
    }

    // Keyboard: E = pick up when near, P = pull pin, Space = spray
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyE") this.tryPickUpNear();
      if (e.code === "Space") this.setSpray(true);
      if (e.code === "KeyP") this.pullPin();
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") this.setSpray(false);
    });
  },
  pickUp() {
    if (!state.running) {
      setStatus("Start the simulation first", "warn");
      return;
    }
    if (state.extinguisher.picked) return;
    state.extinguisher.picked = true;
    state.extinguisher.pinPulled = false;
    state.extinguisher.spraying = false;
    state.extinguisher.sweep = 0;

    // Parent to camera so it feels held
    const camera = document.querySelector("#camera");
    if (camera) camera.appendChild(this.el);
    this.el.setAttribute("position", "0.35 -0.35 -0.65");
    this.el.setAttribute("rotation", "0 -20 0");

    show("passCard");
    setStatus("Extinguisher picked — press P to pull pin, then Space to spray", "good");
  },
  tryPickUpNear() {
    if (!state.running || state.extinguisher.picked) return;
    const cameraObj = document.querySelector("#camera")?.object3D;
    const extObj = this.el.object3D;
    if (!cameraObj || !extObj) return;
    const THREE = AFRAME.THREE;
    const camPos = new THREE.Vector3();
    const extPos = new THREE.Vector3();
    cameraObj.getWorldPosition(camPos);
    extObj.getWorldPosition(extPos);
    const dist = camPos.distanceTo(extPos);
    if (dist < 2.0) {
      this.pickUp();
    } else {
      setStatus("Move closer to the extinguisher (use WASD)", "warn");
    }
  },
  pullPin() {
    if (!state.extinguisher.picked) return;
    if (state.extinguisher.pinPulled) return;
    state.extinguisher.pinPulled = true;
    setStatus("Pin pulled — aim at the base of the fire, hold Space to spray", "good");
  },
  setSpray(on) {
    if (!state.running) return;
    if (!state.extinguisher.picked) return;
    if (!state.extinguisher.pinPulled) {
      if (on) setStatus("Pull the pin first (press P)", "warn");
      return;
    }

    state.extinguisher.spraying = on;
    if (on) {
      setStatus("Spraying — sweep side to side", "good");
      if (!this.sprayCone) {
        const cone = document.createElement("a-cone");
        cone.setAttribute("radius-bottom", "0.22");
        cone.setAttribute("radius-top", "0.02");
        cone.setAttribute("height", "1.6");
        cone.setAttribute("color", "#cfe8ff");
        cone.setAttribute("material", "opacity:0.35; transparent:true");
        cone.setAttribute("position", "0.25 0.55 -1.15");
        cone.setAttribute("rotation", "90 0 0");
        cone.setAttribute("animation__flicker", "property: material.opacity; dir: alternate; dur: 140; loop: true; from: 0.18; to: 0.42");
        this.sprayCone = cone;
        const camera = document.querySelector("#camera");
        if (camera) camera.appendChild(cone);
      }
    } else {
      if (this.sprayCone && this.sprayCone.parentNode) this.sprayCone.parentNode.removeChild(this.sprayCone);
      this.sprayCone = null;
    }
  },
  tick(_, dt) {
    if (!state.running) return;
    const dtSec = (dt || 0) / 1000;

    // Determine aiming: if cursor ray intersects fire and user is spraying
    // A-Frame cursor doesn't expose intersection globally; use scene raycaster on camera direction.
    const cameraObj = document.querySelector("#camera")?.object3D;
    const sceneEl = this.el.sceneEl;
    const fireObj = document.querySelector("#fire")?.object3D;
    if (!cameraObj || !sceneEl || !fireObj) return;

    const THREE = AFRAME.THREE;
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();
    cameraObj.getWorldPosition(origin);
    cameraObj.getWorldDirection(direction);
    const raycaster = new THREE.Raycaster(origin, direction, 0.1, 6.0);

    const hits = raycaster.intersectObject(fireObj, true);
    state.extinguisher.aiming = hits.length > 0;

    // Sweep requirement: while spraying and aiming, require some look movement to count as "sweep"
    if (state.extinguisher.spraying && state.extinguisher.aiming) {
      state.extinguisher.sweep = Math.min(1, state.extinguisher.sweep + dtSec * 0.55);
    } else if (state.extinguisher.spraying && !state.extinguisher.aiming) {
      setStatus("Aim at the base of the fire", "warn");
    }

    // If user is spraying but not sweeping much, reduce effect a bit by lowering aiming flag
    if (state.extinguisher.spraying && state.extinguisher.aiming && state.extinguisher.sweep < 0.35) {
      // still helps, just less (handled in updateFireAndSmoke)
    }
  },
});

AFRAME.registerComponent("smoke-hazard", {
  init() {
    this.cameraObj = this.el.object3D;
    this.fireZone = document.querySelector("#fireZone")?.object3D;
  },
  tick(_, dt) {
    if (!state.running) return;
    const dtSec = (dt || 0) / 1000;
    if (!this.cameraObj || !this.fireZone) return;

    // Rough "in zone" check: distance to fireZone center
    const THREE = AFRAME.THREE;
    const camPos = new THREE.Vector3();
    const zonePos = new THREE.Vector3();
    this.cameraObj.getWorldPosition(camPos);
    this.fireZone.getWorldPosition(zonePos);
    const dist = camPos.distanceTo(zonePos);
    const inZone = dist < 5.0;

    // Smoke severity increases with smoke level and being near the zone
    const severity = inZone ? state.smokeLevel : state.smokeLevel * 0.45;

    // "Crawl low": camera Y below ~1.1 helps a lot
    const y = camPos.y;
    const low = y < 1.1;

    if (severity < 0.25) {
      setSmokeRisk("Low", "good");
    } else if (severity < 0.55) {
      setSmokeRisk(low ? "Moderate (low is good)" : "Moderate", "warn");
    } else {
      setSmokeRisk(low ? "High (you are low)" : "High — get low", "bad");
    }

    // Training feedback: if smoke is high and not low posture, apply time pressure via status
    if (severity > 0.65 && !low) {
      setStatus("Smoke is dangerous — crouch/crawl low!", "bad");
      // Make timer feel harsher by subtly accelerating the fire if user stays high in heavy smoke
      state.fireIntensity = clamp01(state.fireIntensity + 0.02 * dtSec);
    }
  },
});

AFRAME.registerComponent("fire-zone", {
  init() {
    this.lastTick = nowMs();
    this.cameraObj = document.querySelector("#camera")?.object3D;
    this.fireObj = document.querySelector("#fire")?.object3D;
  },
  tick() {
    if (!state.running) return;
    const t = nowMs();
    const dtSec = (t - this.lastTick) / 1000;
    this.lastTick = t;
    updateFireAndSmoke(dtSec);

    // Fire collision check (simple radius around fire)
    const THREE = AFRAME.THREE;
    if (this.cameraObj && this.fireObj) {
      const camPos = new THREE.Vector3();
      const firePos = new THREE.Vector3();
      this.cameraObj.getWorldPosition(camPos);
      this.fireObj.getWorldPosition(firePos);
      const dist = camPos.distanceTo(firePos);
      if (dist < 1.0) {
        killPlayer("You walked into the fire. In real emergencies, never move into flames — retreat and use exits.");
      }
    }
  },
});

AFRAME.registerComponent("player-physics", {
  init() {
    this.rig = this.el;
    this.prevPos = this.rig.object3D.position.clone();
  },
  tick() {
    if (!this.rig) return;
    const pos = this.rig.object3D.position;
    // Simple collision against outer walls: keep player inside building bounds.
    const minX = -6.5;
    const maxX = 6.5;
    const minZ = -4.7;
    const maxZ = 1.9;

    if (pos.x < minX || pos.x > maxX || pos.z < minZ || pos.z > maxZ) {
      // Revert to last safe position when hitting wall area.
      pos.copy(this.prevPos);
    } else {
      this.prevPos.copy(pos);
    }
  },
});

AFRAME.registerComponent("game-manager", {
  init() {
    // Wire UI buttons
    $("btnStart").addEventListener("click", startSimulation);
    $("btnTips").addEventListener("click", showTips);
    $("btnQuiz").addEventListener("click", showQuiz);
    $("btnBackFromTips").addEventListener("click", () => {
      hide("tipsCard");
      show("startCard");
    });
    $("btnBackFromQuiz").addEventListener("click", () => {
      hide("quizCard");
      show("startCard");
    });
    $("btnRestart").addEventListener("click", startSimulation);

    $("btnQuizA").addEventListener("click", () => answerQuiz(0));
    $("btnQuizB").addEventListener("click", () => answerQuiz(1));
    $("btnQuizC").addEventListener("click", () => answerQuiz(2));

    // Global tick: timer + win/loss conditions
    this.lastUiTick = nowMs();
    resetSimulation();
  },
  tick() {
    const t = nowMs();
    if (t - this.lastUiTick > 200) {
      this.lastUiTick = t;
      updateTimer();

      if (state.running) {
        // If fire gets too large, force evacuation emphasis.
        if (state.fireIntensity > 0.92) setStatus("Fire is growing — evacuate now!", "bad");
        // If user extinguishes fire enough, suggest evacuation (still should exit).
        if (state.fireIntensity < 0.35) setStatus("Fire reduced — evacuate via the safe exit", "good");
      }
    }
  },
});

