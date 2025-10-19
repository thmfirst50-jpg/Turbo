const canvas = document.getElementById('fullCanvas');
const canvasContainer = canvas.parentElement;
const ctx = canvas.getContext('2d');
let drawing = false;

let canvases = {};        // { qNum: dataURL }
let activeQuestion = null;
let questionsDict = {};

// Helper: draw background grid
function drawGrid(lineWidth = 1, cellSize = 30, color = "#ded6d6ff") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    for (let x = 0; x <= canvas.width; x += cellSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += cellSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

// Helper: draw centered placeholder text
function drawPlaceholderText() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "24px Arial";
    ctx.fillStyle = "#888";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Please upload a file", canvas.width / 2, canvas.height / 2);
}

// Async helper: draw a dataURL into canvas and wait until drawn
function drawDataUrlToCanvas(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // draw image scaled to canvas
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve();
        };
        img.onerror = function (e) {
            reject(e);
        };
        img.src = dataUrl;
    });
}

// Resize canvas and re-render whatever should be visible
function resizeCanvas() {
    const navbarHeight = document.querySelector('nav').offsetHeight;
    // keep previous width/height so image scaling works after resize
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - navbarHeight;

    // Render appropriate content after resizing
    renderCurrent();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // initial size

// Render current active question or placeholder/grid
async function renderCurrent() {
    // If no questions loaded yet -> placeholder
    if (!Object.keys(questionsDict).length || activeQuestion === null) {
        drawPlaceholderText();
        return;
    }

    document.getElementById('page-counter').textContent = activeQuestion;

    // If activeQuestion has saved data, draw it (async)
    if (canvases[activeQuestion]) {
        try {
            await drawDataUrlToCanvas(canvases[activeQuestion]);
        } catch (e) {
            console.error("Error drawing saved canvas:", e);
            drawGrid();
        }
    } else {
        // no saved drawing yet -> show grid (blank)
        drawGrid();
        try {
            canvases[activeQuestion] = canvas.toDataURL('image/png');
        } catch (e) {
            console.warn("Could not save blank state:", e);
        }
    }

    
    const questionBox = document.getElementById("questionBox");

    const fixed = questionsDict[activeQuestion]
    .replaceAll('\\\\(', '\\(')
    .replaceAll('\\\\)', '\\)');

    questionBox.innerHTML = fixed;

    if (window.MathJax) {
      MathJax.typesetPromise([questionBox]);
    }
    
}

/* ---------------- Pointer / drawing events (unchanged behavior) ---------------- */

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
        return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    } else {
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
}

function startDraw(e) {
    drawing = true;
    ctx.beginPath();
    const pos = getPos(e);
    ctx.moveTo(pos.x, pos.y);
}

function draw(e) {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#007bff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
}

function stopDraw() {
    if (!drawing) return;
    drawing = false;
    // autosave the current canvas to dataURL for the active question
    if (activeQuestion !== null) {
        try {
            canvases[activeQuestion] = canvas.toDataURL('image/png');
        } catch (e) {
            console.warn("Could not autosave canvas:", e);
        }
    }
}

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mouseout', stopDraw);

canvas.addEventListener('touchstart', startDraw, { passive: true });
canvas.addEventListener('touchmove', draw, { passive: true });
canvas.addEventListener('touchend', stopDraw);
canvas.addEventListener('touchcancel', stopDraw);

/* ---------------- End drawing events ---------------- */

/* initial UI state */
if (!Object.keys(questionsDict).length) {
    drawGrid();
    drawPlaceholderText();
}

/* ---------------- backend + UI controls ---------------- */

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

  if (activeQuestion == null) {
    console.log("No Active Question");
    return;
  }

  const question = questionsDict[activeQuestion];
  const canvasData = canvas.toDataURL('image/png'); // convert canvas data to png image

  const startTime = performance.now();
  const response = await fetch('/hint', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ question: question, image: canvasData })
  });
  const endTime = performance.now();

  console.log(`Call HINT took ${endTime - startTime} milliseconds`)

  const data = await response.json();
  console.log("TEXT FEEDBACK: ", data.textFeedback);

  const audioBytes = Uint8Array.from(atob(data.audioFeedback), c => c.charCodeAt(0));
  const blob = new Blob([audioBytes], { type: "audio/mpeg" });
  const audioUrl = URL.createObjectURL(blob);

  const audio = new Audio(audioUrl);
  audio.play();
}

hintBtn.addEventListener('click', getHint);

uploadBtn.addEventListener('click', () => fileInput.click());

speakerBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/speak');
        const audioData = await response.blob();
        const audioUrl = URL.createObjectURL(audioData);
        const audio = new Audio(audioUrl);
        audio.play();
    } catch (error) {
        console.error("Error generating speech:", error);
    }
});

fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload_doc', { method: 'POST', body: formData });
        const result = await response.json();
        console.log("Server response:", result);

        // reset state
        questionsDict = {};
        canvases = {};
        activeQuestion = null;

        if (result.questions && Array.isArray(result.questions) && result.questions.length) {
            // fill questionsDict with numeric keys starting at 1
            result.questions.forEach((q, index) => {
                const qNum = index + 1;
                questionsDict[qNum] = q;
            });
            // set first question active and render it
            activeQuestion = 1;
            await renderCurrent();
        } else if (result.error) {
            console.log(result.error);
            drawPlaceholderText();
        } else {
            console.log("Unexpected upload response:", result);
            drawPlaceholderText();
        }
    } catch (error) {
        console.error("Upload failed:", error);
        alert("Error reading document.");
        drawPlaceholderText();
    }
});

/* ---------------- navigation ---------------- */

function getQuestionCount() {
    return Object.keys(questionsDict).length;
}

function updatePageCounter() {
    const counterDiv = document.getElementById('page-counter');

    if (activeQuestion !== null) {
        counterDiv.textContent = activeQuestion;
    } else {
        counterDiv.textContent = 0; // or blank, if you prefer
    }
}

async function loadQuestion(qNum) {
    // save current active before switching
    if (activeQuestion !== null && activeQuestion !== qNum) {
        try {
            canvases[activeQuestion] = canvas.toDataURL('image/png');
        } catch (e) {
            console.warn("Could not auto-save current canvas:", e);
        }
    }

    // set new active
    activeQuestion = qNum;

    console.log(document.getElementById('page-counter').textContent);

    // render the newly active question
    await renderCurrent();
}

document.getElementById('RightArrowBtn').addEventListener('click', async () => {
    const count = getQuestionCount();
    if (count === 0) return;
    if (activeQuestion === null) {
        activeQuestion = 1;
    } else if (activeQuestion < count) {
        activeQuestion += 1;
    }
    await renderCurrent();
    console.log("ACTIVE:", activeQuestion);
});

document.getElementById('leftArrowBtn').addEventListener('click', async () => {
    const count = getQuestionCount();
    if (count === 0) return;
    if (activeQuestion === null) {
        activeQuestion = 1;
    } else if (activeQuestion > 1) {
        activeQuestion -= 1;
    }
    await renderCurrent();
    console.log("ACTIVE:", activeQuestion);
});
