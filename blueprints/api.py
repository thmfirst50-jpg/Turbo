# blueprints/api.py
import os, re, base64, json, requests
from flask import Blueprint, request, jsonify
from dotenv import load_dotenv
#import google.generativeai as genai

# Load .env 
load_dotenv()

api_bp = Blueprint("api", __name__)

# --- Keys / config ---
MATHPIX_APP_ID = os.getenv("MATHPIX_APP_ID")
MATHPIX_APP_KEY = os.getenv("MATHPIX_APP_KEY")

GEMINI_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)
    GEMINI_SPLIT = genai.GenerativeModel("gemini-1.5-flash")
    GEMINI_SOLVE = genai.GenerativeModel("gemini-1.5-flash")
else:
    GEMINI_SPLIT = GEMINI_SOLVE = None

def _json_only(text: str) -> dict:
    """Extract a JSON object from a model reply that may include code fences."""
    m = re.search(r"\{[\s\S]*\}\s*$", (text or "").strip())
    payload = m.group(0) if m else text
    return json.loads(payload)

# --- /api/ocr : send canvas/upload to Mathpix ---
@api_bp.route("/ocr", methods=["POST"])
def ocr():
    if not (MATHPIX_APP_ID and MATHPIX_APP_KEY):
        return jsonify({"error": "Mathpix keys not set"}), 500

    try:
        files = None
        data_url = None

        if request.is_json:
            data = request.get_json(silent=True) or {}
            data_url = data.get("imageDataUrl")

        if data_url and data_url.startswith("data:image/"):
            header, b64 = data_url.split(",", 1)
            image_bytes = base64.b64decode(b64)
            files = {"file": ("canvas.png", image_bytes, "image/png")}
        elif "file" in request.files:
            f = request.files["file"]
            files = {"file": (f.filename or "upload.png", f.stream, f.mimetype or "image/png")}
        else:
            return jsonify({"error": "Provide imageDataUrl or file"}), 400

        payload = {
            "options_json": json.dumps({
                "ocr": ["math", "text"],
                "rm_spaces": True,
                "math_inline_delimiters": ["$", "$"]
            })
        }

        r = requests.post(
            "https://api.mathpix.com/v3/text",
            headers={"app_id": MATHPIX_APP_ID, "app_key": MATHPIX_APP_KEY},
            data=payload,
            files=files,
            timeout=60
        )
        return (r.text, r.status_code, {"Content-Type": "application/json"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- /api/split : parse OCR text into questions
@api_bp.route("/split", methods=["POST"])
def split_questions():
    if GEMINI_SPLIT is None:
        return jsonify({"error": "Gemini key not set"}), 500

    body = request.get_json(silent=True) or {}
    ocr_text = body.get("ocr_text") or body.get("ocrText")
    if not ocr_text:
        return jsonify({"error": "ocr_text required"}), 400

    prompt = f"""
You are parsing a worksheet. Extract distinct questions.

Return ONLY JSON:
{{ "questions": [{{"id":"q1","question_text":"...","question_latex":"(optional)"}}] }}

Worksheet text (may contain LaTeX):
{ocr_text}
"""
    try:
        resp = GEMINI_SPLIT.generate_content(prompt)
        return jsonify(_json_only(resp.text))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- /api/solve : solve a question 
@api_bp.route("/solve", methods=["POST"])
def solve_question():
    if GEMINI_SOLVE is None:
        return jsonify({"error": "Gemini key not set"}), 500

    body = request.get_json(silent=True) or {}
    q_text = body.get("question_text") or ""
    q_latex = body.get("question_latex") or ""

    prompt = f"""
You are a patient math tutor. Solve step-by-step and end with a boxed LaTeX answer.

Question (prefer LaTeX if present):
{q_latex}

Text:
{q_text}

Return ONLY JSON:
{{ "reasoning_md": "...", "final_answer_latex": "\\\\boxed{{...}}" }}
"""
    try:
        resp = GEMINI_SOLVE.generate_content(prompt)
        return jsonify(_json_only(resp.text))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
