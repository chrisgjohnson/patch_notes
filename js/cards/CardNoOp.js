class CardNoOp extends ComputerCard {
    static meta = {
        id: 'none',
        name: '',
        num: '',
        desc: "Blank Card. Does nothing."
    };

    constructor(context, ioNode) {
        super(context, ioNode);
    }
    mount() {}
    unmount() {}
    update(a, b, c) {}
}

// --- REGISTER CARD ---
if (registerCard) {
    registerCard(CardNoOp);
}