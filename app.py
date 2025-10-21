from flask import Flask, render_template, request, jsonify, Response
import os
import io
from mpxpy.mathpix_client import MathpixClient
import base64
from dotenv import load_dotenv
from google import genai
from google.genai import types
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play
from dotenv import load_dotenv
import time
import random

load_dotenv()

app = Flask(__name__)

UPLOAD_FOLDER = os.path.join("static", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Your Mathpix credentials from environment variables
app_id = os.getenv("MATHPIX_APP_ID")
app_key = os.getenv("MATHPIX_APP_KEY")
gemini_key = os.getenv("GEMINI_API_KEY")
labs_api_key=os.getenv("ELEVENLABS_API_KEY")

geminiClient = genai.Client(api_key=gemini_key)
client = MathpixClient(app_id=app_id, app_key=app_key)
elevenlabs = ElevenLabs(api_key=labs_api_key)

voiceIds = ["2EiwWnXFnvU5JabPnv8n", "IKne3meq5aSn9XLyUdCD", "2EiwWnXFnvU5JabPnv8n", "cgSgspJ2msm6clMCkdW9", "pFZP5JQG7iQjIQuC4Bku", "EXAVITQu4vr4xnSDxMaL"]
selectedVoice = "pFZP5JQG7iQjIQuC4Bku"

@app.route('/')
def index():
    return render_template('index.html')

#sends mathpix markdown to console
# @app.route('/recognize', methods=['POST'])
# def recognize():
#     data = request.json
#     image_data = data.get('image')  # base64 string starting with "data:image/png;base64,..."

#     # Strip the prefix if it exists
#     if image_data.startswith("data:image/png;base64,"):
#         image_data = image_data.split(",")[1]

#     # Convert to bytes
#     image_bytes = base64.b64decode(image_data)

#     # Save the image bytes to a temporary file
#     with open("temp_image.png", "wb") as f:
#         f.write(image_bytes)

#     # Process the image using Mathpix
#     image = client.image_new(file_path="temp_image.png", include_line_data=True)

#     # Get the Mathpix Markdown (MMD) representation
#     mmd = image.mmd()
#     print("MMD OUTPUT\n", mmd)

#     # Get line-by-line OCR data
#     lines = image.lines_json()
#     print("LINES OUTPUT\n", lines)

#     return jsonify(lines)

@app.route("/upload_doc", methods=["POST"])
def upload_doc():
    global selectedVoice
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    filename = file.filename.lower()

    if not filename:
        return jsonify({"error": "Empty filename"}), 400
    
    save_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(save_path)

    # selectedVoice = random.choice(voiceIds)

    if file.filename.endswith(".pdf"):
        pdf = client.pdf_new(file_path=save_path)
        pdf.wait_until_complete(timeout=60)
        mmd = pdf.to_md_text()
    elif file.filename.endswith((".png", ".jpg", ".jpeg")):
        image = client.image_new(file_path=save_path, include_line_data=True)
        mmd = image.mmd()
    
    return uploadQuestions(mmd)

def uploadQuestions(questions):
    response = geminiClient.models.generate_content(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            system_instruction="""
                    you will be given questions. Your task is to identify and seperate the questions.
                    The output should be in the following format:
                    QUESTION_1, QUESTION_2, ..., QUESTION_N.
                    Seperate each question with a comma
            """,
            response_mime_type="application/json",
            response_schema= list[str],
            ),
        contents=f"QUESTIONS: {questions}",
    )

    questionsList = response.parsed
    
    return jsonify({"questions": questionsList})

def sendQuestionGemini(question, canvasLatex):
    response = geminiClient.models.generate_content(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            system_instruction="""
                    You are a helpful tutor. Let the user know what they are doing wrong, and the next step should be.
                    Keep responses brief.
            """,
            response_mime_type="application/json",
            response_schema= list[str],
            ),
        contents=f"QUESTION: {question}, STUDENT_WORK: {canvasLatex}",
    )

    return response.parsed


@app.route("/hint", methods=['POST'])
def hint():
    data = request.json

    # question
    question_data = data.get('question')

    # user's work converted to markdown
    image_data = data.get('image')
    if image_data.startswith("data:image/png;base64,"):
        image_data = image_data.split(",")[1]
    image_bytes = base64.b64decode(image_data)
    with open("temp_image.png", "wb") as f:
        f.write(image_bytes)
    
    start_time = time.time()
    image = client.image_new(file_path="temp_image.png", include_line_data=True)
    end_time = time.time()
    mmd = image.mmd()

    # send to gemini for processing
    start_time_g = time.time()
    result = sendQuestionGemini(question_data, mmd)
    end_time_g = time.time()

    ". ".join(result)

    textFeedback = str(result[0])
    start_time_e = time.time()
    audio_gen = elevenlabs.text_to_speech.convert(
        text=textFeedback,
        voice_id=selectedVoice,
        model_id="eleven_turbo_v2",
        output_format="mp3_44100_128",
    )
    end_time_e = time.time()

    print("Elevenlabs Processing:", end_time_e - start_time_e, "seconds")
    print("Gemini Processing:", end_time_g - start_time_g, "seconds")
    print("Mathpix Processing:", end_time - start_time, "seconds")

    # If generator, combine all chunks
    if hasattr(audio_gen, '__iter__') and not isinstance(audio_gen, bytes):
        audio_bytes = b"".join(audio_gen)
    else:
        audio_bytes = audio_gen

    # base64 encode audio bytes
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

    return jsonify({
        "textFeedback": textFeedback,
        "audioFeedback": audio_base64
    })


@app.route('/speak', methods=['GET'])
def speak(textFeedback):
    try:
        # Generate audio (might return a generator)
        audio_gen = elevenlabs.text_to_speech.convert(
            text=f"{textFeedback}",
            voice_id=selectedVoice,
            model_id="eleven_turbo_v2",
            output_format="mp3_44100_128",
        )

        # If it's a generator, convert it to bytes
        if hasattr(audio_gen, '__iter__') and not isinstance(audio_gen, bytes):
            audio_bytes = b"".join(audio_gen)
        else:
            audio_bytes = audio_gen

        return Response(
            io.BytesIO(audio_bytes),
            mimetype="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=speech.mp3"}
        )

    except Exception as e:
        print("Error generating speech:", e)
        return "Server Error", 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80, debug=True)