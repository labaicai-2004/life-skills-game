"""Render the project's original pentatonic loop with no third-party samples."""
import math
import struct
import wave
from pathlib import Path

RATE = 22050
BEAT = 0.625
LENGTH = 32 * BEAT
melody = [72, None, 76, 79, 81, None, 79, 76,
          74, None, 76, 79, 76, None, 74, None,
          72, None, 74, 76, 79, None, 76, 74,
          76, None, 74, None, 72, None, None, None]
samples = [0.0] * round(RATE * LENGTH)


def note(midi, when, strength):
    frequency = 440 * 2 ** ((midi - 69) / 12)
    duration = 1.8
    for i in range(round(RATE * duration)):
        t = i / RATE
        attack = min(1.0, t / 0.008)
        value = attack * (math.sin(2 * math.pi * frequency * t) * math.exp(-5 * t)
                          + 0.22 * math.sin(2 * math.pi * frequency * 3 * t) * math.exp(-12 * t)
                          + 0.08 * math.sin(2 * math.pi * frequency * 6 * t) * math.exp(-20 * t))
        samples[(round(when * RATE) + i) % len(samples)] += strength * value


for beat, pitch in enumerate(melody):
    if pitch is not None:
        note(pitch, beat * BEAT, 0.30 if beat % 4 == 0 else 0.24)
for beat, pitch in [(0, 48), (4, 55), (8, 50), (12, 55),
                    (16, 48), (20, 55), (24, 53), (28, 48)]:
    note(pitch, beat * BEAT, 0.14)

assert max(abs(s) for s in samples) < 0.95
output = Path(__file__).resolve().parents[1] / 'music' / 'xylophone.wav'
output.parent.mkdir(exist_ok=True)
with wave.open(str(output), 'wb') as audio:
    audio.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
    audio.writeframes(b''.join(struct.pack('<h', round(s * 32767)) for s in samples))
print(f'{output.name}: {LENGTH:.1f}s, {output.stat().st_size} bytes')
