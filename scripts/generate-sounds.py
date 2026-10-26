"""Original synthesized chess feedback. Source and resulting WAV files: CC0-1.0."""
from pathlib import Path
import math
import struct
import wave

RATE = 22050
for name, notes, duration in [
    ('move', [420, 620], 0.095),
    ('capture', [180, 280, 370], 0.14),
    ('check', [660, 880], 0.24),
]:
    samples = []
    for i in range(int(RATE * duration)):
        t = i / RATE
        envelope = min(t / 0.004, 1) * math.exp(-t * 35)
        tone = sum(math.sin(2 * math.pi * f * t) for f in notes) / len(notes)
        samples.append(struct.pack('<h', int(tone * envelope * 14000)))
    destination = Path(__file__).resolve().parents[1] / 'public' / 'sounds' / (name + '.wav')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(destination), 'wb') as sound:
        sound.setnchannels(1)
        sound.setsampwidth(2)
        sound.setframerate(RATE)
        sound.writeframes(b''.join(samples))
