# Sound model and numerical contract

Sound format 1.0 is independent from sprite format 1.0. Use CLI discovery for
operation schemas. Defaults are materialized when parsing and saving. Unknown
versions fail; future migrations require an explicit source→target transform,
never reinterpretation of old data.

Mono; rates 22050, 44100 (default), 48000 Hz. Duration 1–10000 ms; sample count
round(durationMs*rate/1000). Maximum 32 voices, 16 effects, 16 resonator modes,
64 envelope points and 40 million estimated DSP work units. IDs are unique across
voices/effects. Seeds are unsigned 32-bit. No expressions or executable fields.

Oscillators integrate phase in cycles with left-endpoint frequency sampling.
Linear/exponential pitch trajectories span the project duration. Saw and pulse
(including square) use PolyBLEP. Triangle is the direct piecewise waveform and
can alias at high pitch. Oscillator amplitude modulation has depth [0,1], rate
[0,100] Hz. Frequency remains below .45*sampleRate.

White noise uses xorshift32-v1, with project seed mixed into a stable FNV-1a
UTF-16 voice-ID hash. Each voice owns its stream. Filtered noise uses a one-pole
lowpass. Keeping seed and voice ID retains the stream across unrelated edits.

Custom envelope points have increasing times beginning at zero and linear
interpolation; last value holds. ADSR uses right-continuous zero-length stages;
attack+decay+release cannot exceed duration. Output has an explicit default 2 ms
boundary fade; no automatic tail extension. Effect tails end at project duration.

Linear ODE dz/dt=(-lambda+i*2*pi*f)z uses exponential stepping. Nonlinear ODE
dz/dt=(sigma+i*2*pi*f)z+(cReal+i*cImag)|z|z uses RK4 substeps bounded by 128,
with <=.2 estimated phase/stiffness advance per substep. cReal<=0; positive sigma
can produce sustained oscillation when cReal<0. State magnitude >64 or nonfinite
values fail with voice ID. Resonator modes use exact damped sine functions.

Ordered lowpass→distortion→lowpass effects form a Wiener-Hammerstein chain.
One-pole lowpass coefficient is 1-exp(-2*pi*cutoff/rate); highpass subtracts its
lowpass component. Delay stores dry+feedback*delayed; wet/dry are linearly mixed,
feedback magnitude <=.95. Distortion offers tanh, hard/asymmetric clipping and
logarithmic branches A*log1p(x/B)+C*x and -D*log1p(-x/E)+F*x.
B,E>0. Game coefficients are normalized/dimensionless, not circuit calibration.
Physical paper parameters represent voltage scales, current scales and resistance.

Default distortion oversampling is 4x: linear reconstruction then two lowpass
stages before decimation. This reduces aliasing, with frequency coloration and
extra work; it is not an ideal reconstruction filter. 1x explicitly trades quality
for cost. No calibrated amplifier/circuit fidelity is claimed.

Voices mix in document order. No normalization. Explicit error/hard clipping;
peak/RMS describe final PCM, clippedSamples counts pre-clamp exceedances.
WAV is mono signed PCM16 LE: round(x*32768) negative, round(x*32767) nonnegative.
Same runtime/source/seed reproduce bytes. Transcendental math can differ across
engines; compare PCM tolerance as well as hashes.

Methods: Stefanakis et al., DOI 10.1162/COMJ_a_00314; Schuck Jr. et al.,
DOI 10.1007/978-3-030-16077-7_33, equation 33.8. Original implementation;
research PDFs are not distributed.
