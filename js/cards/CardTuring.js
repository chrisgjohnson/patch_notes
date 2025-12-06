class CardTuring extends ComputerCard {
    static meta = {
        id: 'turing',
        name: 'Turing Machine',
        num: '03',
        desc: "Random Looping Sequencer. \nIn: Pulse 1 (Clock), CV 1 (Diviply Mod) \nKnob X: Sequence Length (2-16) \nKnob Y: Ch2 Divider \nMain: Probability (Noon=Rnd, CW=Lock, CCW=Flip) \nOut: CV 1/2 (Pitch), Pulse 1/2 (Clock), Audio L/R (Bipolar Mod)"
    };

    constructor(ctx, io) {
        super(ctx, io);

        // --- STATE ---
        this.reg1 = Math.floor(Math.random() * 65536);
        this.reg2 = Math.floor(Math.random() * 65536);
        
        this.length = 16;
        this.scaleIndex = 0;
        
        // Clocking
        this.clockHighState = false; 
        this.lastPulseTime = 0;
        this.clockCounter = 0; 
        this.divider = 1;

        // Tap Tempo
        this.lastSwitch = -1;
        this.lastTapTime = 0;
        this.clockInterval = 0.5;

        // Visual State
        this.lastLength = 16;
        this.lastLengthChangeTime = -10;
        this.pulse1ActiveTime = 0;
        this.pulse2ActiveTime = 0;

        // Configuration
        this.validLengths = [2, 3, 4, 5, 6, 8, 12, 16];
        this.lengthPatterns = {
            2:  0b110000, 3:  0b111000, 4:  0b111100, 5:  0b111110,
            6:  0b111111, 8:  0b001111, 12: 0b000011, 16: 0b110011
        };
        this.scales = [
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Chromatic
            [0, 2, 4, 5, 7, 9, 11],                 // Major
            [0, 2, 3, 5, 7, 8, 10],                 // Minor
            [0, 3, 5, 7, 10],                       // Minor Pent
            [0, 2, 3, 5, 7, 9, 10],                 // Dorian
            [0, 1, 3, 7, 10],                       // Pelog
            [0, 2, 4, 6, 8, 10]                     // Wholetone
        ];

        // --- AUDIO NODES ---
        // Pitch CVs
        this.cv1 = ctx.createConstantSource(); this.cv1.start();
        this.cv2 = ctx.createConstantSource(); this.cv2.start();
        
        // Pulses
        this.pulse1 = ctx.createConstantSource(); this.pulse1.start();
        this.pulse2 = ctx.createConstantSource(); this.pulse2.start();

        // Stepped Modulation CVs (Audio Outs)
        this.mod1 = ctx.createConstantSource(); this.mod1.start();
        this.mod2 = ctx.createConstantSource(); this.mod2.start();

        // Internal OSC (for monitoring)
        this.osc = ctx.createOscillator();
        this.osc.type = 'square';
        this.osc.start();
        this.oscGain = ctx.createGain();
        this.oscGain.gain.value = 0.0; // Muted by default, used only if needed or low mix

        // Sensors
        this.clockSensor = ctx.createAnalyser();
        this.clockSensor.fftSize = 32;
        this.clockData = new Uint8Array(this.clockSensor.frequencyBinCount);

        this.cvSensor = ctx.createAnalyser();
        this.cvSensor.fftSize = 32;
        this.cvData = new Uint8Array(this.cvSensor.frequencyBinCount);
    }

    mount() {
        this.cv1.connect(this.io.cv1Out);
        this.cv2.connect(this.io.cv2Out);
        this.pulse1.connect(this.io.pulse1Out);
        this.pulse2.connect(this.io.pulse2Out);
        
        // Connect Bipolar Mod Sources to Audio Outs
        this.mod1.connect(this.io.outputL);
        this.mod2.connect(this.io.outputR);

        this.io.pulse1In.connect(this.clockSensor);
        this.io.cv1In.connect(this.cvSensor);
    }

    unmount() {
        this.cv1.disconnect(); this.cv2.disconnect();
        this.pulse1.disconnect(); this.pulse2.disconnect();
        this.mod1.disconnect(); this.mod2.disconnect();
        this.io.pulse1In.disconnect(this.clockSensor);
        this.io.cv1In.disconnect(this.cvSensor);
    }

    update(p, time) {
        // 1. CONTROLS
        const lenIdx = Math.floor(p.x * (this.validLengths.length - 0.01));
        const newLength = this.validLengths[lenIdx] || 16;
        
        if (newLength !== this.length) {
            this.length = newLength;
            this.lastLengthChangeTime = time;
        }

        // --- DIVIPLY LOGIC (Knob Y + CV 1) ---
        this.cvSensor.getByteTimeDomainData(this.cvData);
        const cv1Mod = (this.cvData[0] - 128) / 128.0; 

        let divInput = p.y + cv1Mod;
        if (divInput < 0) divInput = 0; 
        if (divInput > 1) divInput = 1;

        const divOptions = [1, 2, 3, 4, 6, 8, 12, 16];
        const divIdx = Math.floor(divInput * (divOptions.length - 0.01));
        this.divider = divOptions[divIdx] || 1;

        // Switch Logic
        if ((2-p.switch) === 2) this.scaleIndex = 1; // Major
        else if ((2-p.switch) === 1) this.scaleIndex = 2; // Minor
        else this.scaleIndex = 6; // Wholetone

        // 2. CLOCK DETECTION
        this.clockSensor.getByteTimeDomainData(this.clockData);
        const rawClock = this.clockData[0]; 
        const THRESHOLD_HIGH = 220; 
        const THRESHOLD_LOW = 180;  
        const isCablePlugged = (rawClock > 140 || rawClock < 115);

        let trigger = false;

        if (isCablePlugged) {
            if (!this.clockHighState && rawClock > THRESHOLD_HIGH) {
                trigger = true;
                this.clockHighState = true;
            } 
            else if (this.clockHighState && rawClock < THRESHOLD_LOW) {
                this.clockHighState = false;
            }
        } else {
            // Tap Tempo
            if ((2-p.switch) === 0 && this.lastSwitch !== 0) {
                const diff = time - this.lastTapTime;
                if (diff > 0.1 && diff < 2.0) {
                    this.clockInterval = diff;
                    trigger = true; 
                    this.lastPulseTime = time;
                } 
                this.lastTapTime = time;
            }
            if (time - this.lastPulseTime > this.clockInterval) {
                trigger = true;
                this.lastPulseTime = time;
            }
        }

        this.lastSwitch = (2-p.switch);

        if (trigger) this.step(p, time);

        this.updateVisuals(time);
    }

    step(p, time) {
        // 3. PROBABILITY
        let probability = p.main; 
        
        // --- MACHINE 1 ---
        this.reg1 = this.updateRegister(this.reg1, this.length, probability);
        this.updateOutput(1, this.reg1, time);
        this.triggerPulse(this.pulse1, time);
        this.pulse1ActiveTime = time;

        // --- MACHINE 2 ---
        this.clockCounter++;
        if (this.clockCounter >= this.divider) {
            this.clockCounter = 0;
            this.reg2 = this.updateRegister(this.reg2, this.length, probability);
            this.updateOutput(2, this.reg2, time);
            this.triggerPulse(this.pulse2, time);
            this.pulse2ActiveTime = time;
        }
    }

    updateRegister(reg, len, knobVal) {
        const bitAtLength = (reg >> (len - 1)) & 1;
        const randomVal = Math.random();
        let newBit = (randomVal >= knobVal) ? (bitAtLength === 1 ? 0 : 1) : bitAtLength;
        return ((reg << 1) | newBit) & 0xFFFF;
    }

    updateOutput(channel, reg, time) {
        const byteVal = reg & 0xFF;
        const scale = this.scales[this.scaleIndex] || this.scales[0];
        
        const totalNotesInRange = 60; 
        const rawNoteIndex = Math.floor((byteVal / 255.0) * totalNotesInRange);
        const octave = Math.floor(rawNoteIndex / scale.length);
        const noteClass = scale[rawNoteIndex % scale.length];
        
        const midiNote = 36 + (octave * 12) + noteClass; 
        
        // Pitch CV: 0.1V per Octave
        const cvVal = (midiNote - 60) / 120.0;
        const bipolarMod = (byteVal / 255.0) * 1 - 0.5;

        if (channel === 1) {
            safeParam(this.cv1.offset, cvVal, time);
            safeParam(this.mod1.offset, bipolarMod, time); // Audio L Out
            
            // Clamped internal osc for monitoring
            let freq = 261.63 * Math.pow(2, cvVal * 10);
            if (freq > 20000) freq = 20000;
            if (freq < 20) freq = 20;
            safeParam(this.osc.frequency, freq, time);
        } else {
            safeParam(this.cv2.offset, cvVal, time);
            safeParam(this.mod2.offset, bipolarMod, time); // Audio R Out
        }
    }

    triggerPulse(node, time) {
        node.offset.setValueAtTime(1, time);
        node.offset.setTargetAtTime(0, time + 0.01, 0.01);
    }

    updateVisuals(time) {
        if (time - this.lastLengthChangeTime < 1.5) {
            const pattern = this.lengthPatterns[this.length] || 0;
            for (let i = 0; i < 6; i++) {
                const isActive = (pattern >> (5 - i)) & 1; 
                this.setLed(i, isActive ? 1.0 : 0.0);
            }
        } 
        else {
            this.setLed(0, (this.reg1 & 0xFF) / 255.0); 
            this.setLed(1, (this.reg2 & 0xFF) / 255.0); 
            this.setLed(2, (this.reg1 & 0xFF) / 255.0); 
            this.setLed(3, (this.reg2 & 0xFF) / 255.0); 
            
            const p1 = (time - this.pulse1ActiveTime < 0.1) ? 1.0 : 0.0;
            const p2 = (time - this.pulse2ActiveTime < 0.1) ? 1.0 : 0.0;
            this.setLed(4, p1); 
            this.setLed(5, p2); 
        }
    }

    setLed(index, brightness) {
        const led = document.getElementById(`led-comp-${index}`);
        if (!led) return;

        if (brightness > 0.1) {
            led.classList.add('active');
            led.style.backgroundColor = `rgba(239, 68, 68, ${brightness})`; 
            led.style.boxShadow = `0 0 ${6 * brightness}px rgba(239, 68, 68, ${brightness})`;
        } else {
            led.classList.remove('active');
            led.style.backgroundColor = '';
            led.style.boxShadow = '';
        }
    }
}

if (window.registerCard) {
    window.registerCard(CardTuring);
}