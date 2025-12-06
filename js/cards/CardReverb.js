class CardReverb extends ComputerCard {
    static meta = {
        id: 'reverb',
        name: 'Reverb+',
        num: '01',
        desc: "Stereo Reverb with Low/Highpass Filter. \nIn: Audio L/R \nKnob X: Decay Time \nKnob Y: Filter Tone \nMain: Dry/Wet Mix \nOut: Audio L/R"
    };

    constructor(ctx, io) {
        super(ctx, io);

        this.dryL = ctx.createGain();
        this.dryR = ctx.createGain();
        this.wetL = ctx.createGain();
        this.wetR = ctx.createGain();

        this.convL = ctx.createConvolver();
        this.convR = ctx.createConvolver();
        this.filter = ctx.createBiquadFilter();

        // Noise source for Default CV2
        const bSize = ctx.sampleRate * 2;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < bSize; i++) d[i] = Math.random() * 2 - 1;
        
        this.noise = ctx.createBufferSource();
        this.noise.buffer = b;
        this.noise.loop = true;
        this.lastLen = 0;
    }

    mount() {
        this.noise.start();

        // Dry Path
        this.io.inputL.connect(this.dryL).connect(this.io.outputL);
        this.io.inputR.connect(this.dryR).connect(this.io.outputR);

        // Wet Path
        this.io.inputL.connect(this.convL).connect(this.filter);
        this.io.inputR.connect(this.convR).connect(this.filter);
        
        this.filter.connect(this.wetL).connect(this.io.outputL);
        this.filter.connect(this.wetR).connect(this.io.outputR);

        // Default Jacks
        if (audioNodes) {
            if (audioNodes['Midi_Pitch']) audioNodes['Midi_Pitch'].connect(this.io.cv1Out);
            if (audioNodes['Midi_Gate']) audioNodes['Midi_Gate'].connect(this.io.pulse1Out);
        }
        this.noise.connect(this.io.cv2Out);
    }

    unmount() {
        this.noise.stop();
        
        [this.dryL, this.dryR, this.wetL, this.wetR, this.convL, this.convR, this.filter, this.noise].forEach(node => {
            try { node.disconnect(); } catch (e) {}
        });

        if (audioNodes) {
            try { if (audioNodes['Midi_Pitch']) audioNodes['Midi_Pitch'].disconnect(this.io.cv1Out); } catch (e) {}
            try { if (audioNodes['Midi_Gate']) audioNodes['Midi_Gate'].disconnect(this.io.pulse1Out); } catch (e) {}
        }
    }

    update(p, time) {
        // Reverb Length
        const revLen = 0.5 + (p.x * 4.5);
        if (Math.abs(this.lastLen - revLen) > 0.1) {
            if (typeof generateReverbImpulse === 'function') {
                this.convL.buffer = generateReverbImpulse(revLen, 2.0);
                this.convR.buffer = generateReverbImpulse(revLen, 2.0);
            }
            this.lastLen = revLen;
        }

        // Filter Tone
        const mix = (p.y * 2) - 1;
        if (mix < 0) {
            this.filter.type = 'lowpass';
            safeParam(this.filter.frequency, 1000 + (mix + 1) * 15000, time);
        } else {
            this.filter.type = 'highpass';
            safeParam(this.filter.frequency, mix * 5000, time);
        }

        // Dry/Wet Mix
        const w = p.main;
        const d = 1.0 - w;
        safeParam(this.dryL.gain, d, time);
        safeParam(this.dryR.gain, d, time);
        safeParam(this.wetL.gain, w, time);
        safeParam(this.wetR.gain, w, time);
    }
}

// --- REGISTER CARD ---
if (registerCard) {
    registerCard(CardReverb);
}