// =========================================================================
// CardTwists.js: Braids Macro Oscillator (Full DSP in Worklet)
// =========================================================================

// --- 1. WORKLET PROCESSOR CODE (DSP Audio Thread) ---


// --- 2. MAIN THREAD CLASS ---


class CardTwists extends ComputerCard {
    static meta = {
        id: 'twists',
        name: 'Twists',
        num: '47',
        // UPDATED DESCRIPTION: Now reflects dual Pulse/Gate inputs
        desc: "Macro Oscillator. \nIn: Pulse 1 (Pulse), Pulse 2 (Gate), CV 1 (Pitch) \nKnob X: Timbre \nKnob Y: Color \nMain: Pitch Offset \nSwitch: Select Shape \nOut: Audio L/R (Out), Shapes: ['CSAW', 'FOLD', 'SAWx3', 'ZLPF', 'VOWL', 'HARM']"
    };

    constructor(ctx, io) {
        super(ctx, io);

        const PROCESSOR_NAME = 'twists-processor';
        
        // --- STATE ---
        this.shapeIndex = 0;
        this.shapes = ['CSAW', 'FOLD', 'SAWx3', 'ZLPF', 'VOWL', 'HARM'];
        this.lastSwitch = 0;
        this.midiOffset = 60; 
        this.envelope = 0; 
        this.lastPulse1High = false; // For Pulse 1 rising edge detection
        this.lastPulse2High = false; // For Pulse 2 state

        // --- AUDIO NODES ---
        this.worklet = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            parameterData: { pitch_freq: 440 }
        });

        this.worklet.port.onmessage = (e) => {
            if (e.data.envelope !== undefined) {
                this.envelope = e.data.envelope;
            }
        };

        // Sensors
        this.pulse1Sensor = this.createSensor(ctx); // NEW: for Pulse 1 In (Trigger)
        this.pulse2Sensor = this.createSensor(ctx); // NEW: for Pulse 2 In (Gate)
        this.cvSensor = this.createSensor(ctx);
        
        const BUFFER_SIZE = 32;
        this.pulse1Data = new Uint8Array(BUFFER_SIZE); 
        this.pulse2Data = new Uint8Array(BUFFER_SIZE);
        this.cvData = new Uint8Array(BUFFER_SIZE); 
        
        this.gain = ctx.createGain();
        this.worklet.connect(this.gain);
    }

    createSensor(ctx) {
        const a = ctx.createAnalyser();
        a.fftSize = 32;
        return a;
    }

    mount() {
        // Calls the parent mount to handle LED reset
        super.mount(); 
        
        this.io.inputL.disconnect(); 
        this.io.inputR.disconnect();

        // ** CHANGE: Connect pulse sensors to Pulse 1 In (Trigger) and Pulse 2 In (Gate) **
        this.io.pulse1In.connect(this.pulse1Sensor);
        this.io.pulse2In.connect(this.pulse2Sensor);
        this.io.cv1In.connect(this.cvSensor);
        
        // Audio fix: Ensure gain is set
        this.gain.gain.value = 1.0; 
        
        this.gain.connect(this.io.outputL);
        this.gain.connect(this.io.outputR);
        
        // MIDI Routing (Matches CardReverb: Midi CV/Gate out of computer)
        if (audioNodes) {
            if (audioNodes['Midi_Pitch']) audioNodes['Midi_Pitch'].connect(this.io.cv1Out);
            if (audioNodes['Midi_Gate']) audioNodes['Midi_Gate'].connect(this.io.pulse1Out);
        }
    }

    unmount() {
        super.unmount(); // Calls the parent unmount
        
        // ** CHANGE: Disconnect both pulse sensors **
        this.io.pulse1In.disconnect();
        this.io.pulse2In.disconnect();
        this.io.cv1In.disconnect();
        this.gain.disconnect();
        this.worklet.disconnect();

        // Disconnect MIDI
        if (audioNodes) {
            try { if (audioNodes['Midi_Pitch']) audioNodes['Midi_Pitch'].disconnect(this.io.cv1Out); } catch (e) {}
            try { if (audioNodes['Midi_Gate']) audioNodes['Midi_Gate'].disconnect(this.io.pulse1Out); } catch (e) {}
        }
    }

    update(p, time) {
        // 1. Controls & Pitch Calculation
        const p1 = p.x * 32767;
        const p2 = p.y * 32767;

        this.cvSensor.getByteTimeDomainData(this.cvData);
        const cvRaw = (this.cvData[0] - 128) / 128.0; 
        
        const knobPitch = p.main * 60; 
        const cvPitch = cvRaw * 60;
        const midiNote = this.midiOffset + knobPitch + cvPitch; 
        
        // Calculate Frequency
        const freq = 0.25 * 261.63 * Math.pow(2, (midiNote - 60) / 12);

        // 2. Send Frequency to Worklet's AudioParam
        this.worklet.parameters.get('pitch_freq').setTargetAtTime(
            freq, time, 0.005
        );

        // 3. Gate Logic (from Pulse 1 In and Pulse 2 In)
        
        // Pulse 1 In: One-shot Trigger (Pulse)
        this.pulse1Sensor.getByteTimeDomainData(this.pulse1Data);
        const currentPulse1High = this.pulse1Data[0] > 200;
        const isPulseTrigger = currentPulse1High && !this.lastPulse1High; // Rising Edge
        this.lastPulse1High = currentPulse1High;

        // Pulse 2 In: Continuous Gate (Sustain)
        this.pulse2Sensor.getByteTimeDomainData(this.pulse2Data);
        const currentPulse2High = this.pulse2Data[0] > 200;
        
        // 4. Shape Selection
        if ((2-p.switch) === 0 && this.lastSwitch !== 0) {
             this.shapeIndex = (this.shapeIndex + 1) % this.shapes.length;
        }
        this.lastSwitch = 2-p.switch;
        
        // 5. Send Parameters (Timbre, Color, Shape, Pulse, Gate)
        this.worklet.port.postMessage({
            p1: p1,
            p2: p2,
            shape: this.shapes[this.shapeIndex],
            pulse: isPulseTrigger,      // One-shot trigger
            gate: currentPulse2High     // Continuous gate
        });

        // 6. LED Visuals
        this.updateLEDs(this.envelope);
    }

    updateLEDs(amp) {
        // LEDs 0-5: Show Shape Index (using all 6 LEDs)
        for(let i=0; i<6; i++) {
            const led = document.getElementById(`led-comp-${i}`);
            if(led) {
                if (i === this.shapeIndex) {
                    led.classList.add('active');
                    led.style.backgroundColor = '#ff0404ff'; 
                } else {
                    led.classList.remove('active');
                    led.style.backgroundColor = '';
                }
            }
        }
    }
}

if (window.registerCard) {
    window.registerCard(CardTwists);
}

