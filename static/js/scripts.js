const canvas = document.getElementById('fullCanvas');
const canvasContainer = canvas.parentElement;
const ctx = canvas.getContext('2d');
let drawing = false;

let canvases = {};        // { qNum: dataURL }
let activeQuestion = null;
let questionsDict = {};

let currentColor = "#007bff";
let currentTool = "draw";
let currentLineWidth = 2;

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawPlaceholderText() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "24px Arial";
    ctx.fillStyle = "#888";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Please upload a file", canvas.width / 2, canvas.height / 2);
}

/* ------------------- Helpers ------------------- */
function drawDataUrlToCanvas(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve();
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

/* ------------------- Resize Handling ------------------- */
function resizeCanvas() {
    const navbarHeight = document.querySelector('nav')?.offsetHeight || 0;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - navbarHeight;
    renderCurrent();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* ------------------- Render Question ------------------- */
async function renderCurrent() {
    if (!Object.keys(questionsDict).length || activeQuestion === null) {
        drawPlaceholderText();
        return;
    }

    document.getElementById('page-counter').textContent = activeQuestion;

    if (canvases[activeQuestion]) {
        try {
            await drawDataUrlToCanvas(canvases[activeQuestion]);
        } catch (e) {
            console.error("Error drawing saved canvas:", e);
            clearCanvas();
        }
    } else {
        clearCanvas();
        canvases[activeQuestion] = canvas.toDataURL('image/png');
    }

    const questionBox = document.getElementById("questionBox");
    const fixed = questionsDict[activeQuestion]
        .replaceAll('\\\\(', '\\(')
        .replaceAll('\\\\)', '\\)');
    questionBox.innerHTML = fixed;

    if (window.MathJax) MathJax.typesetPromise([questionBox]);
}

/* ------------------- Drawing Controls ------------------- */
const colorPicker = document.getElementById("colorPicker");
const eraseMenu = document.getElementById("eraseMenu");

colorPicker.addEventListener("input", (e) => {
  currentColor = e.target.value;
  ctx.strokeStyle = currentColor;
});

eraseMenu.addEventListener("change", (e) => {
  currentTool = e.target.value;

  if (currentTool === "clear") {
    clearCanvas();
    canvases[activeQuestion] = canvas.toDataURL('image/png');
    eraseMenu.value = "draw";
    currentTool = "draw";
  }
});

/* ------------------- Drawing Logic (Optimized for Stylus + Touch) ------------------- */
let lastPos = { x: 0, y: 0 };

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
        const t = e.touches[0];
        return { x: t.clientX - rect.left, y: t.clientY - rect.top, pressure: t.force || 1 };
    } else {
        return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 1 };
    }
}

/* ---------------- Improved drawing input with palm rejection ---------------- */

let stylusActive = false;

document.addEventListener('selectstart', (e) => e.preventDefault());
document.addEventListener('touchstart', (e) => {
  if (e.target === canvas) e.preventDefault();
}, { passive: false });

// Detect input type and handle palm rejection
canvas.addEventListener('pointerdown', (e) => {
    // Only start drawing if using stylus or mouse
    if (e.pointerType === 'pen' || e.pointerType === 'mouse') {
        stylusActive = (e.pointerType === 'pen');
        drawing = true;
        ctx.beginPath();
        const rect = canvas.getBoundingClientRect();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        e.preventDefault();
    }
});

canvas.addEventListener('pointermove', (e) => {
    // Ignore finger touches if stylus is active (palm rejection)
    if (stylusActive && e.pointerType === 'touch') return;

    if (drawing) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (currentTool === "erase") {
            ctx.globalCompositeOperation = "destination-out";
            ctx.lineWidth = 20;
        } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = 2;
        }

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineTo(x, y);
        ctx.stroke();
        e.preventDefault();
    }
});

canvas.addEventListener('pointerup', (e) => {
    if (drawing) {
        drawing = false;
        stylusActive = false;
        ctx.closePath();
        // save canvas state
        if (activeQuestion !== null) {
            canvases[activeQuestion] = canvas.toDataURL('image/png');
        }
    }
});

canvas.addEventListener('pointercancel', () => {
    drawing = false;
    stylusActive = false;
});

/* ------------------- Initial UI ------------------- */
if (!Object.keys(questionsDict).length) {
    clearCanvas();
    drawPlaceholderText();
}

/* ------------------- Backend Communication ------------------- */
async function sendCanvasToMathpix() {
    const dataURL = canvas.toDataURL('image/png');
    const response = await fetch('/recognize', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ image: dataURL })
    });
    const result = await response.json();
    console.log("Mathpix Result:", result);
}
document.getElementById('recognizeBtn').addEventListener('click', sendCanvasToMathpix);

const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const speakerBtn = document.getElementById('speakerBtn');
const hintBtn = document.getElementById('hintBtn');

async function getHint() {
  if (activeQuestion == null) return;

  const question = questionsDict[activeQuestion];
  const canvasData = canvas.toDataURL('image/png');

  const startTime = performance.now();
  const response = await fetch('/hint', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ question, image: canvasData })
  });
  const endTime = performance.now();

  console.log(`Call HINT took ${endTime - startTime} milliseconds`);

  const data = await response.json();
  const audioBytes = Uint8Array.from(atob(data.audioFeedback), c => c.charCodeAt(0));
  const blob = new Blob([audioBytes], { type: "audio/mpeg" });
  const audioUrl = URL.createObjectURL(blob);

  const feedbackBox = document.getElementById('hintFeedback');
  feedbackBox.textContent = data.textFeedback;

  const audio = new Audio(audioUrl);
  audio.play();
}
hintBtn.addEventListener('click', getHint);

uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    document.getElementById('loadingOverlay').style.display = 'flex';

    try {
        const response = await fetch('/upload_doc', { method: 'POST', body: formData });
        const result = await response.json();

        questionsDict = {};
        canvases = {};
        activeQuestion = null;

        if (result.questions?.length) {
            result.questions.forEach((q, index) => questionsDict[index + 1] = q);
            activeQuestion = 1;
            await renderCurrent();
        } else {
            drawPlaceholderText();
        }
    } catch (error) {
        console.error("Upload failed:", error);
        alert("Error reading document.");
        drawPlaceholderText();
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
});

/* ------------------- Navigation ------------------- */
function getQuestionCount() {
    return Object.keys(questionsDict).length;
}

async function loadQuestion(qNum) {
    if (activeQuestion !== null && activeQuestion !== qNum) {
        canvases[activeQuestion] = canvas.toDataURL('image/png');
    }
    activeQuestion = qNum;
    await renderCurrent();
}

document.getElementById('RightArrowBtn').addEventListener('click', async () => {
    const count = getQuestionCount();
    if (!count) return;
    if (activeQuestion < count) {
        activeQuestion += 1;
        await renderCurrent();
    }
});
document.getElementById('leftArrowBtn').addEventListener('click', async () => {
    const count = getQuestionCount();
    if (!count) return;
    if (activeQuestion > 1) {
        activeQuestion -= 1;
        await renderCurrent();
    }
});
