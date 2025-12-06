// js_modules/computer.js

// 1. Initialize Registry
window.AVAILABLE_CARDS = [];

// 2. Registration Helper (Cards call this to add themselves)
window.registerCard = function(CardClass) {
    const meta = CardClass.meta || { id: 'unknown', name: 'Unknown', num: '??', desc: '' };
    window.AVAILABLE_CARDS.push({
        id: meta.id,
        name: meta.name,
        num: meta.num,
        desc: meta.desc,
        class: CardClass
    });
};



// =========================================================================
// CORE LOGIC
// =========================================================================

function swapComputerCard(typeIdOrName) {
    // 1. Find the Card Definition
    let cardDef = window.AVAILABLE_CARDS.find(c => c.id === typeIdOrName || c.name === typeIdOrName);

    // Fallback if not found
    if (!cardDef) {
        cardDef = window.AVAILABLE_CARDS.find(c => c.id === 'reverb') || window.AVAILABLE_CARDS[0];
    }
    
    // If still nothing (e.g. no cards loaded yet), stop
    if (!cardDef) return;

    // 2. Cleanup Old Card
    if (activeComputerCard) {
        if (activeComputerCard.unmount) activeComputerCard.unmount();
        activeComputerCard = null;
    }

    // 3. Create New Card (THE FIX IS HERE)
    // We only create the real card if the Audio Engine is ready.
    if (window.audioCtx && window.audioNodes && window.audioNodes['Computer_IO']) {
        try {
            // Real Mode: Audio is ON
            activeComputerCard = new cardDef.class(window.audioCtx, window.audioNodes['Computer_IO']);
            activeComputerCard.mount();
        } catch (e) {
            console.error("Card Init Failed:", e);
            activeComputerCard = createDummyCard(cardDef);
        }
    } else {
        // Ghost Mode: Audio is OFF (Page Load)
        // We create a fake object so the UI shows the name, but no audio code runs.
        activeComputerCard = createDummyCard(cardDef);
    }

    // 4. Update UI & Global Reference
    window.activeComputerCard = activeComputerCard;
    updateCardVisuals(cardDef);

    if (typeof window.saveState === 'function') window.saveState();
}

// Helper to create the "Ghost" card
function createDummyCard(cardDef) {
    return {
        name: cardDef.name,
        fake: true,
        mount: () => {},   // Do nothing
        unmount: () => {}, // Do nothing
        update: () => {}   // Do nothing
    };
}

function cycleNextCard() {
    const labelEl = document.getElementById('activeCardLabel');
    const currentName = labelEl ? labelEl.textContent : '';

    let currentIdx = window.AVAILABLE_CARDS.findIndex(c => c.name === currentName);
    if (currentIdx === -1) currentIdx = window.AVAILABLE_CARDS.length - 1;

    const nextIdx = (currentIdx + 1) % window.AVAILABLE_CARDS.length;
    swapComputerCard(window.AVAILABLE_CARDS[nextIdx].id);
}

// =========================================================================
// UI HELPERS (Render Slot, Menus, Etc)
// =========================================================================

function updateCardVisuals(cardDef) {
    const labelEl = document.getElementById('activeCardLabel');
    const digitEl = document.getElementById('activeCardDigits');
    const tooltipEl = document.getElementById('activeCardTooltip');
    const cardEl = document.querySelector('.program-card');

    if (labelEl) labelEl.textContent = cardDef.name;
    if (digitEl) digitEl.textContent = cardDef.num;
    if (tooltipEl) tooltipEl.textContent = cardDef.desc;
    if (cardEl) cardEl.style.opacity = '1';

    // Flash animation
    if (labelEl && cardDef.id !== 'none') {
        labelEl.style.opacity = 0;
        setTimeout(() => { labelEl.style.opacity = 1; }, 50);
    }
}

function renderCardSlot() {
    const container = document.getElementById('synthContainer');
    const old = document.getElementById('computerCardSlot');
    if (old) old.remove();

    const slot = document.createElement('div');
    slot.className = 'card-slot-container';
    slot.id = 'computerCardSlot';
    slot.title = "Left-Click: Cycle | Right-Click: Select Menu";

    const tooltip = document.createElement('div');
    tooltip.className = 'card-tooltip';
    tooltip.id = 'activeCardTooltip';

    const card = document.createElement('div');
    card.className = 'program-card';

    // Initial State
    let labelText = "No Card";
    let numText = "--";
    
    // Try to find the active card from memory or history
    let targetId = 'none';
    if (activeComputerCard) {
        const found = window.AVAILABLE_CARDS.find(c => c.name === activeComputerCard.name);
        if (found) targetId = found.id;
    }

    const def = window.AVAILABLE_CARDS.find(c => c.id === targetId);
    if (def) {
        labelText = def.name;
        numText = def.num;
        tooltip.textContent = def.desc;
    }

    card.innerHTML = `
        <div class="card-label" id="activeCardLabel">${labelText}</div>
        <div class="card-decoration">Music<br>Thing<br>Modular</div>
        <div class="card-digits" id="activeCardDigits">${numText}</div>
    `;

    slot.appendChild(card);
    slot.appendChild(tooltip);

    // Event Listeners
    slot.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left Click
            e.stopPropagation(); e.preventDefault();
            slot.classList.add('insert');
            setTimeout(() => {
                cycleNextCard();
                slot.classList.remove('insert');
                slot.classList.add('eject');
                setTimeout(() => slot.classList.remove('eject'), 150);
            }, 150);
        }
    });

    slot.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        openCardSelector();
    });

    if (container) container.appendChild(slot);
}

function initCardSelector() {
    if (document.getElementById('cardSelectorModal')) return;
    const modal = document.createElement('div');
    modal.id = 'cardSelectorModal';
    modal.innerHTML = `
        <div class="card-modal-content">
            <div class="card-modal-header">
                <span class="card-modal-title">SELECT PROGRAM CARD</span>
                <button class="card-modal-close" id="closeCardModal">&times;</button>
            </div>
            <div id="cardGrid" class="card-grid"></div>
        </div>`;
    document.body.appendChild(modal);
    document.getElementById('closeCardModal').onclick = closeCardSelector;
    modal.onclick = (e) => { if(e.target === modal) closeCardSelector(); };
}

function closeCardSelector() {
    const modal = document.getElementById('cardSelectorModal');
    if (modal) modal.classList.remove('open');
}

function openCardSelector() {
    initCardSelector();
    const modal = document.getElementById('cardSelectorModal');
    const grid = document.getElementById('cardGrid');
    grid.innerHTML = '';

    window.AVAILABLE_CARDS.forEach(card => {
        const el = document.createElement('div');
        el.className = 'mini-card';
        el.innerHTML = `<div class="mc-num">${card.num}</div><div><div class="mc-label">${card.name}</div></div>`;
        el.onclick = () => {
            closeCardSelector();
            swapComputerCard(card.id);
        };
        grid.appendChild(el);
    });
    modal.classList.add('open');
}

// 4. EXPOSE GLOBALS
window.swapComputerCard = swapComputerCard;
window.cycleNextCard = cycleNextCard;
window.renderCardSlot = renderCardSlot;
window.initCardSelector = initCardSelector;
window.openCardSelector = openCardSelector;