ComputerCard = class ComputerCard {
    constructor(ctx, io) {
        this.ctx = ctx;
        this.io = io;
        // Access static meta info safely
        const ctor = this.constructor;
        this.name = ctor.meta ? ctor.meta.name : "Generic Card";
    }

    mount() { 
        console.log(`${this.name} mounted.`); 
        this.resetLEDs();
    }

    unmount() { 
        console.log(`${this.name} unmounted.`); 
        this.resetLEDs();
    }

    update(params, time) {}

    // Helper to clear all Computer LEDs (0-5)
    resetLEDs() {
        for (let i = 0; i < 6; i++) {
            const led = document.getElementById(`led-comp-${i}`);
            if (led) {
                led.classList.remove('active');
                led.style.backgroundColor = '';
                led.style.boxShadow = '';
            }
        }
    }
};