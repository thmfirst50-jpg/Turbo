import os
from elevenlabs import ElevenLabs
from elevenlabs.play import play

labs_api_key=os.getenv("ELEVENLABS_API_KEY")
elevenlabs = ElevenLabs(api_key="sk_633e01a0c151eee9d5f275f94dd77ec96582b94e27af7a15")

voices = elevenlabs.voices.get_all()
for v in voices.voices:
    print(v.name, "-", v.voice_id)

for v in voices.voices:
    audio_gen = elevenlabs.text_to_speech.convert(
        voice_id=v.voice_id,
        model_id="eleven_turbo_v2",
        text=f"This is {v.name}",
        output_format="mp3_44100_128",
    )
    with open(f"audios/{v.name}.mp3", "wb") as f:
        f.write(b"".join(audio_gen))