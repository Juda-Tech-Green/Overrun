# Starting recipes

`audio create NAME --preset PRESET --output FILE` supports:

| Preset           | Design                                                                |
| ---------------- | --------------------------------------------------------------------- |
| laser-shot       | 400 ms, saw 900→120 Hz exponential sweep, lowpass 3200 Hz, 75 ms echo |
| gunshot          | 400 ms, seeded filtered noise transient plus damped 100→45 Hz body    |
| zombie-growl     | 1400 ms, nonlinear ODE + modulated pulse, tanh saturation and lowpass |
| metal-impact     | 1200 ms, damped modes at 440/1193/2371/3599 Hz                        |
| altar-activation | 2400 ms, three rising sine layers, modulation, ADSR, 160 ms echo      |

The presets produce editable documents, not immutable audio clips. Use
`setFrequency`, `setEnvelope`, `setGain`, `setSeed`, `setOde`, `addVoice`,
`removeVoice`, `addEffect`, `removeEffect`. Keep operations in source control.

Example operation batch:

```json
[
  {
    "op": "setFrequency",
    "id": "main",
    "frequency": { "startHz": 1200, "endHz": 160, "curve": "exponential" }
  },
  { "op": "setGain", "id": "main", "gain": 0.3 }
]
```

Render, listen, validate and compare metrics after changes. For metallic impacts,
preserve inharmonic ratios rather than turning all modes into equal harmonics.
For growls, increase saturation gradually; high gain can clip the final output.
