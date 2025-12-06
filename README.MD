# Workshop System Patch Notes

This document details the features and structure of the **Workshop System**, a virtual representation of the Music Thing Modular Workshop System, serving as both a patch-notetaking tool and a functional modular synthesizer emulation.

---

## I. Core Application Features

The system offers a full set of tools for creating, documenting, and sharing complex patches.

### Patch Management & Notes
* **Modular Patching:** Users connect modules using virtual cables dragged between jacks. **Cable properties**, including color and droop, are preserved.
* **Notetaking:** Users can add and style **sticky notes** directly onto the panel, and use a global text area for detailed notes.
* **Export and Saving:** The system supports saving patch states locally as presets, exporting as **JSON** files, and embedding patch data into exportable **PNG** images or **WAV** audio files.

### Synthesis and Effects
* **Program Cards (Computer Module):** A dedicated slot allows loading **complex digital synthesis and utility programs**, controlled by the X, Y, Main, and Z knobs/switches on the front panel.
* **Pedalboard:** A virtual effects chain that connects to the Stompbox module's Send and Return jacks.
    * **Effects:** Includes Distortion, Phaser, Chorus, Delay, and Reverb effects.
    * **Routing:** Pedals can be **dragged and dropped** to reorder the signal chain.

---

## II. Auxiliary Tools

### 4-Track Tape Recorder (`tape.js`)

The recorder is a separate window tool for sampling and processing audio.

* **Transport:** Includes Play, Record, Stop, Loop, and Return to Zero (RTZ).
* **Processing:** Features adjustable **Wow/Flutter** and **Saturation** controls.
* **Routing:** Allows recording the **Main Mix** or an **External Input** (Stereo Line In).
* **Export:** Can export the final mixdown as a **WAV** file (with embedded patch metadata) or individual tracks as **Stems** (ZIP archive).

### Oscilloscope (`scope.js`)

The scope is a visualization tool that runs in a floating window. 

* **Probing:** Two channels (**CH1 and CH2**) can be connected to any output jack on the panel via the right-click menu.
* **Modes:** Supports **Time-Domain**, **Spectrum (FFT)**, and **X-Y** display modes.
* **Analysis:** Provides real-time measurements for Vpp (Peak-to-Peak Voltage) and Frequency (Hz).

---

## III. System Architecture and Code Structure

The application's logic is distributed across several core JavaScript files.

### Code Structure

| File | Description |
| :--- | :--- |
| `globals.js` | Defines the **system configuration** (`SYSTEM_CONFIG`), constants, and all shared state variables. |
| `utils.js` | Contains **general helper functions** for serialization (`optimizeState`), coordinate math, and WAV encoding/metadata handling. |
| `ui.js` | Manages the **rendering of the entire interface**, component interaction (knobs, jacks, pedals), cable drawing, and the history/undo system. |
| `audio-engine.js` | The **core audio graph builder**; it initializes the `AudioContext`, creates Web Audio nodes, and manages routing based on cable connections. |
| `main.js` | The **application entry point**, responsible for initialization, setting up global listeners, and running the `requestAnimationFrame` clock loop. |
| `scope.js` | Handles the **Oscilloscope's UI**, data acquisition, and drawing of waveforms. |
| `tape.js` | Contains all logic for the **4-track tape recorder**, including buffer management and transport controls. |
| `computer.js` | Manages the **swapping and initialization of Program Card modules**. |

### Configuration and State

* **Modular Architecture:** The physical layout is defined by **System Configuration (`SYSTEM_CONFIG`)** and logically grouped by **Module Map (`MODULES_MAP`)**.
* **Program Cards:** Functionality is extended by **Program Cards** (\js\cards), dynamically loaded into the "Computer" module. Cards are registered via `window.registerCard()`.
* **Patch State Export/Import:**
    * **Optimization:** The `optimizeState` function converts the detailed patch state into a highly compressed JSON object by using **short keys** (e.g., `KO1` for `knob-large-osc1`) and rounding values.
    * **Compression:** The optimized JSON object is further compressed using **LZString**.
    * **Export Formats:** This compressed data is used to embed the patch state within PNG images or as a custom `mTmP` chunk in WAV audio files or attached to a sharing URL.

### Dedicated Audio Worklets

* **Slopes Module:** The Slope/Envelope generators (`Slopes1`, `Slopes2`) use a dedicated **AudioWorklet** (`slopes-processor`) to ensure accurate timing and shape generation. This worklet simulates both **exponential** and **linear** envelope behaviors and controls LED visualization by sending PWM-style data back to the UI.
* **Tape Recorder:** The 4-track recorder relies on an **AudioWorklet** (`recorder-processor`) to stream input audio into a large `AudioBuffer` for **sample-accurate** recording and playback.

---

## Development

The application is a web project designed for in-browser use and requires hosting.

1.  **Clone the repository** (assuming a Git environment).
2.  **Serve the files** using a local HTTP server (e.g., `npx http-server`, or VS-Code Live Server).
3.  **Open `patchnotes.html`** in a modern web browser to access the main application interface.