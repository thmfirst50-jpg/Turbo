# Turbo

## Inspiration
We were inspired by the idea of using modern APIs to create a new and fun way of learning — one that’s accessible to anyone with an internet connection and a modern device. We wanted to make studying more interactive, conversational, and human-like.

## What it does
Turbo is a web app that acts as your personal AI tutor. It takes a file as input, parses it through MathPix to extract LaTeX, sends it to Gemini for intelligent processing, and then uses ElevenLabs to read the AI’s response aloud. When users get stuck, they can click a Hint button to receive real-time help — as if a tutor were sitting beside them 24/7.

## How we built it
We built Turbo using Flask for backend routing and API management, and HTML, CSS, and JavaScript for the frontend. Our system integrates multiple APIs — MathPix, Gemini, and ElevenLabs — to parse input, generate meaningful responses, and deliver them with natural-sounding speech.

## Challenges we ran into
We faced several challenges, including setting up and authenticating multiple APIs, managing event-driven calls from JavaScript, and maintaining clean routing between the frontend and backend. Integrating three different services seamlessly was tricky, especially when handling asynchronous responses and formatting data properly for each API.

## Accomplishments that we're proud of
We’re proud of creating a fully functional, interactive learning tool that ties together multiple advanced APIs into a cohesive experience. The UI is clean, intuitive, and demonstrates how AI can enhance learning in a practical and accessible way.

## What we learned
We learned how powerful modern APIs can be when integrated thoughtfully. Working with Flask, JavaScript, and third-party AI services showed us how to combine technologies to create applications that are both effective and enjoyable to use.

## What's next for Turbo
Next, we plan to expand Turbo’s capabilities by adding real-time voice conversation, multi-language support, and better visual recognition for handwritten notes. We also plan to attend more hackathons to continue learning, challenging ourselves, and exploring new technologies and methodologies.

## Built With
bootstrap
elevenlabs
flask
gemini
mathpix
python
