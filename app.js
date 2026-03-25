/* ═══════════════════════════════════════════════════════════════
   01-Wantantan Ramen — Online Order Management System
   app.js
   ═══════════════════════════════════════════════════════════════ */

/* ─── APPLICATION STATE ─── */
let currentTable = 'A1';
let cart = [];
let orders = [];
let nextOrderId = 101;

/* ─── MENU PRICES (VND) ─── */
const PRICES = {
    'Original Tonkotsu': 129000,
    'Spicy Miso Ramen': 139000,
    'Shoyu Ramen': 129000,
    'Gyoza (5 pcs)': 69000,
    'Extra Chashu': 35000,
    'Iced Green Tea': 35000,
    'Coca-Cola': 45000,
    'Matcha Cheesecake': 79000,
    'Matcha Ice Cream': 59000,
};

const TOPPING_PRICE = 15000;

/* ─── HELPERS ─── */
function formatVND(n) {
    return Math.round(n).toLocaleString('vi-VN') + 'đ';
}

function isRamenItem(name) {
    const lower = (name || '').toLowerCase();
    return lower.includes('ramen') || lower.includes('tonkotsu');
}

function inferType(name) {
    const drinkKeywords = ['tea', 'cola', 'coffee', 'juice', 'drink', 'water', 'beer', 'soda'];
    return drinkKeywords.some(k => name.toLowerCase().includes(k)) ? 'drinks' : 'food';
}

function normalizeStatus(s) {
    if (s === 'ready') return 'prep';
    if (s === 'served') return 'done';
    return s; // 'new' | 'prep' | 'done'
}

/* ─── TOAST ─── */
function showToast(msg, isError) {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    document.getElementById('toastIcon').textContent = isError ? '✕' : '✓';
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}

/* ─── PAGE NAVIGATION ─── */
function showPage(name, linkEl) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    if (linkEl) linkEl.classList.add('active');
    window.scrollTo(0, 0);
    if (name === 'kitchen') renderKitchen();
    if (name === 'order') updateCartUI();
}

/* ─── KITCHEN CLOCK ─── */
function updateClock() {
    const el = document.getElementById('kitchenClock');
    if (el) el.textContent = new Date().toLocaleTimeString('vi-VN');
}

setInterval(updateClock, 1000);
updateClock();

/* ═══════════════════════════════════════════════════
   MENU FILTERING
═══════════════════════════════════════════════════ */
function setFilter(btn) {
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterMenu(btn.dataset.category, document.getElementById('menuSearch').value.trim());
}

function filterMenuBySearch() {
    const active = document.querySelector('.filter-tab.active');
    filterMenu(active ? active.dataset.category : 'all', document.getElementById('menuSearch').value.trim());
}

function filterMenu(category, term) {
    term = (term || '').toLowerCase();
    document.querySelectorAll('#menuGrid .menu-card').forEach(card => {
        const matchCat = category === 'all' || card.dataset.category === category;
        const matchText = !term || (card.dataset.name || '').toLowerCase().includes(term);
        card.style.display = matchCat && matchText ? 'flex' : 'none';
    });
}

/* ═══════════════════════════════════════════════════
   BOTTOM SHEET STATE
═══════════════════════════════════════════════════ */
let sheetMode = 'add'; // 'add' | 'edit'
let sheetIndex = -1;
let sheetItemName = '';
let sheetQtyValue = 1;     // for non-ramen items
let sheetRamenQty = 1;     // for ramen items

function openSheetForItem(name, mode, index) {
    sheetMode = mode || 'add';
    sheetIndex = typeof index === 'number' ? index : -1;
    sheetItemName = name;
    sheetQtyValue = 1;
    sheetRamenQty = 1;

    const ramen = isRamenItem(name);

    document.getElementById('sheetTitle').textContent = ramen ? 'Customise Your Ramen' : 'Add to Order';
    document.getElementById('sheetSub').textContent = ramen
        ? 'Choose one in each category. Toppings are optional.'
        : 'Adjust quantity before adding.';

    document.getElementById('sheetRamen').style.display = ramen ? 'block' : 'none';
    document.getElementById('sheetSimple').style.display = ramen ? 'none' : 'block';
    document.getElementById('sheetQtyRamen').style.display = ramen ? 'flex' : 'none';
    document.getElementById('sheetPrimaryBtn').textContent = mode === 'edit' ? 'Update Item' : 'Add to Order';

    document.getElementById('sheetQty').textContent = '1';
    document.getElementById('sheetRamenQtyNum').textContent = '1';

    resetSheetDefaults(ramen);
    updateSheetPrice();

    document.getElementById('sheetBackdrop').classList.add('show');
    document.getElementById('sheet').classList.add('show');
}

function resetSheetDefaults(ramen) {
    if (!ramen) return;
    const defaults = { noodleType: 'Thin straight', firmness: 'Normal', saltiness: 'Regular' };
    document.querySelectorAll('#sheetRamen .option-buttons').forEach(group => {
        const isToppings = group.dataset.key === 'toppings';
        const btns = Array.from(group.querySelectorAll('.opt-btn'));
        btns.forEach(b => b.classList.remove('active'));
        if (!isToppings) {
            const defaultBtn = btns.find(b => b.dataset.value === defaults[group.dataset.key]) || btns[0];
            if (defaultBtn) defaultBtn.classList.add('active');
        }
    });
}

function updateSheetPrice() {
    const el = document.getElementById('sheetPriceLine');
    if (!el) return;
    const base = PRICES[sheetItemName] || 0;
    if (isRamenItem(sheetItemName)) {
        const toppings = document.querySelectorAll('#sheetRamen .opt-btn.toggle.active').length;
        el.textContent = formatVND((base + toppings * TOPPING_PRICE) * sheetRamenQty);
    } else {
        el.textContent = formatVND(base * sheetQtyValue);
    }
}

function closeSheet() {
    document.getElementById('sheetBackdrop').classList.remove('show');
    document.getElementById('sheet').classList.remove('show');
}

function changeSheetQty(delta) {
    sheetQtyValue = Math.max(1, sheetQtyValue + delta);
    document.getElementById('sheetQty').textContent = String(sheetQtyValue);
    updateSheetPrice();
}

function changeSheetQtyRamen(delta) {
    sheetRamenQty = Math.max(1, sheetRamenQty + delta);
    document.getElementById('sheetRamenQtyNum').textContent = String(sheetRamenQty);
    updateSheetPrice();
}

/* ─── Quick add (non-ramen via card click) ─── */
function addMenuItem(name) {
    openSheetForItem(name, 'add', -1);
}

/* ═══════════════════════════════════════════════════
   RAMEN CUSTOMIZATION
═══════════════════════════════════════════════════ */
function openRamen(name) {
    openSheetForItem(name, 'add', -1);
}

function openRamenFromHome(name) {
    showPage('menu', document.querySelector('.nav-links a:nth-child(2)'));
    setTimeout(() => openRamen(name), 200);
}

function chooseSingle(btn) {
    const group = btn.closest('.option-buttons');
    group.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateSheetPrice();
}

function toggleTopping(btn, fromSheet) {
    btn.classList.toggle('active');
    if (fromSheet) updateSheetPrice();
}

function getRamenSelections(scopeSelector) {
    const sel = {};
    document.querySelectorAll(scopeSelector + ' .option-buttons').forEach(group => {
        const key = group.dataset.key;
        if (key === 'toppings') {
            sel[key] = Array.from(group.querySelectorAll('.opt-btn.toggle.active')).map(b => b.dataset.value);
        } else {
            const active = group.querySelector('.opt-btn.active');
            sel[key] = active ? active.dataset.value : null;
        }
    });
    return sel;
}

function buildRamenNotes(sel) {
    return [
        'Noodles: ' + (sel.noodleType || 'Thin straight'),
        'Firmness: ' + (sel.firmness || 'Normal'),
        'Saltiness: ' + (sel.saltiness || 'Regular'),
        'Toppings: ' + ((sel.toppings && sel.toppings.length) ? sel.toppings.join(', ') : 'None'),
    ].join(' · ');
}

/* ═══════════════════════════════════════════════════
   SHEET CONFIRM  (add OR edit)
═══════════════════════════════════════════════════ */
function confirmSheet() {
    const ramen = isRamenItem(sheetItemName);
    const qty = ramen ? sheetRamenQty : sheetQtyValue;

    /* ── EDIT mode ── */
    if (sheetMode === 'edit' && cart[sheetIndex]) {
        if (ramen) {
            const sel = getRamenSelections('#sheetRamen');
            const price = (PRICES[sheetItemName] + (sel.toppings || []).length * TOPPING_PRICE) * qty;
            cart[sheetIndex] = { name: sheetItemName, qty, notes: buildRamenNotes(sel), price };
        } else {
            const unit = PRICES[sheetItemName] || 0;
            cart[sheetIndex].qty = qty;
            cart[sheetIndex].price = unit * qty;
        }
        updateCartUI();
        closeSheet();
        showToast('Item updated');
        return;
    }

    /* ── ADD mode ── */
    if (ramen) {
        const sel = getRamenSelections('#sheetRamen');
        const price = (PRICES[sheetItemName] + (sel.toppings || []).length * TOPPING_PRICE) * qty;
        cart.push({ name: sheetItemName, qty, notes: buildRamenNotes(sel), price });
    } else {
        const unit = PRICES[sheetItemName];
        if (!unit) { showToast('Item not available', true); return; }
        cart.push({ name: sheetItemName, qty, notes: '—', price: unit * qty });
    }

    updateCartUI();
    closeSheet();
    showToast('Added to order — ' + sheetItemName);
    showPage('order', document.querySelector('.nav-links a:nth-child(3)'));
}

/* ═══════════════════════════════════════════════════
   CART / ORDER REVIEW
═══════════════════════════════════════════════════ */
function updateCartUI() {
    const body = document.getElementById('cartBody');
    if (!body) return;
    body.innerHTML = '';
    let total = 0;

    if (!cart.length) {
        body.innerHTML = `
      <tr><td colspan="5">
        <div class="cart-empty">
          <div class="cart-empty-icon">🍜</div>
          <div>Your order is empty.</div>
          <div style="margin-top:6px; font-size:11px; color:#999;">Go to the menu to add items.</div>
        </div>
      </td></tr>`;
    } else {
        cart.forEach((item, i) => {
            total += item.price;
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td data-label="Item" style="cursor:pointer;" onclick="openEditFromCart(${i})">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-notes cart-notes-mobile">${item.notes}</div>
        </td>
        <td data-label="Qty">
          <div class="cart-qty-ctrl">
            <button class="cart-qty-btn" onclick="changeCartQty(${i}, -1)">−</button>
            <span class="cart-qty-num">${item.qty}</span>
            <button class="cart-qty-btn" onclick="changeCartQty(${i}, 1)">+</button>
          </div>
        </td>
        <td data-label="Customisation" class="cart-td-notes" style="cursor:pointer;" onclick="openEditFromCart(${i})">
          <div class="cart-item-notes">${item.notes}</div>
        </td>
        <td data-label="Price" class="cart-price">${formatVND(item.price)}</td>
        <td><button class="cart-remove" onclick="removeCartItem(${i})">✕</button></td>`;
            body.appendChild(tr);
        });
    }

    document.getElementById('cartTotal').textContent = formatVND(total);
}

function openEditFromCart(index) {
    const item = cart[index];
    if (!item) return;
    sheetRamenQty = item.qty;
    sheetQtyValue = item.qty;
    openSheetForItem(item.name, 'edit', index);
    document.getElementById('sheetQty').textContent = String(item.qty);
    document.getElementById('sheetRamenQtyNum').textContent = String(item.qty);
}

function changeCartQty(index, delta) {
    const item = cart[index];
    if (!item) return;
    const unitPrice = item.price / item.qty;
    item.qty = Math.max(1, item.qty + delta);
    item.price = unitPrice * item.qty;
    updateCartUI();
}

function getTotalAmount() {
    return cart.reduce((sum, item) => sum + item.price, 0);
}

function removeCartItem(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function selectPay(el) {
    document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('active'));
    el.classList.add('active');
}


function confirmOrder() {
    if (!cart.length) {
        showToast('Add items before confirming!', true);
        return;
    }

    const payEl = document.querySelector('.pay-method.active');
    const isQR = payEl && payEl.dataset.pay === 'paid';

    // 👉 CASE 1: QR PAYMENT (VNPAY)
    if (isQR) {
        const orderId = "ORDER_" + Date.now();
        const amount = getTotalAmount();

        payWithVNPay(orderId, amount);

        return; // ⛔ dừng, chưa gửi bếp
    }

    // 👉 CASE 2: CASH → xử lý như cũ
    processOrder('unpaid');
}
function processOrder(paymentStatus, orderId = null) {
    const now = Date.now();

    cart.forEach((item, idx) => {
        orders.push({
            id: nextOrderId++,
            table: currentTable,
            item: item.name,
            qty: item.qty,
            notes: item.notes,
            status: 'new',
            paymentStatus: paymentStatus,
            type: inferType(item.name),
            createdAt: now + idx,
            orderId: orderId || null
        });
    });

    cart = [];
    updateCartUI();
    renderKitchen();

    if (paymentStatus === 'paid') {
        showToast('✅ Payment success & order sent!');
    } else {
        showToast('Order sent (cash)');
    }
}

let currentQrOrderId = null;

async function payWithVNPay(orderId, amount) {
    try {
        currentQrOrderId = orderId;
        const res = await fetch('http://localhost:3000/api/payment/create-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, amount })
        });

        const data = await res.json();

        // Show VietQR in a popup
        const qrUrl = `https://img.vietqr.io/image/vietinbank-113366668888-compact.jpg?amount=${amount}&addInfo=${orderId}`;
        document.getElementById('qrImage').src = qrUrl;
        document.getElementById('qrLink').href = data.paymentUrl;

        document.getElementById('qrModalBackdrop').classList.add('show');
        document.getElementById('qrModal').classList.add('show');

    } catch (err) {
        console.error(err);
        showToast('Payment error!', true);
    }
}

function closeQrModal() {
    document.getElementById('qrModalBackdrop').classList.remove('show');
    document.getElementById('qrModal').classList.remove('show');
}

function completeQrPayment() {
    closeQrModal();
    if (cart.length > 0) {
        processOrder('paid', currentQrOrderId);
        showToast('Order sent (QR)', false);
        showPage('order', document.querySelector('.nav-links a:nth-child(3)'));
    }
}

/* ═══════════════════════════════════════════════════
   KITCHEN DISPLAY
═══════════════════════════════════════════════════ */
function renderKitchen() {
    const buckets = {
        drinks: { new: [], prep: [], done: [] },
        food: { new: [], prep: [], done: [] },
    };

    [...orders]
        .sort((a, b) => a.createdAt - b.createdAt)
        .forEach(order => {
            const col = normalizeStatus(order.status);
            const grp = order.type === 'food' ? buckets.food : buckets.drinks;
            if (grp[col]) grp[col].push(order);
        });

    ['drinks', 'food'].forEach(type => {
        ['new', 'prep', 'done'].forEach(col => {
            const el = document.getElementById(type + '-' + col);
            if (!el) return;
            el.innerHTML = '';

            buckets[type][col].forEach(order => {
                const paidClass = order.paymentStatus === 'paid' ? 'paid' : 'unpaid';
                const paidLabel = order.paymentStatus === 'paid' ? '✓ PAID' : '⚠ UNPAID';
                const normStatus = normalizeStatus(order.status);
                const minutesAgo = Math.max(0, Math.round((Date.now() - order.createdAt) / 60000));
                const timeLabel = minutesAgo === 0 ? 'Just now' : minutesAgo + ' min ago';

                const card = document.createElement('div');
                card.className = `order-card status-${normStatus}`;
                card.innerHTML = `
          <div class="order-top">
            <div>
              <div class="order-id">#${order.id}</div>
              <div class="order-table">Table ${order.table}</div>
            </div>
            <span class="badge-pay ${paidClass}">${paidLabel}</span>
          </div>
          <div class="order-main">${order.item}</div>
          <div class="order-qty">Qty: ${order.qty}</div>
          ${order.notes && order.notes !== '—'
                        ? `<div class="order-notes">${order.notes}</div>`
                        : ''}
          <div class="order-footer">
            <span class="badge-pay ${paidClass}" style="font-size:10px;">${paidLabel}</span>
            <select class="status-select" onchange="updateOrderStatus(${order.id}, this.value)">
              <option value="new"  ${normStatus === 'new' ? 'selected' : ''}>🔴 New Order</option>
              <option value="prep" ${normStatus === 'prep' ? 'selected' : ''}>🟡 In Preparation</option>
              <option value="done" ${normStatus === 'done' ? 'selected' : ''}>🟢 Completed</option>
            </select>
          </div>
          <div class="time-chip">${timeLabel}</div>`;

                el.appendChild(card);
            });
        });
    });
}

function updateOrderStatus(orderId, newStatus) {
    orders = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    renderKitchen();
}

/* ═══════════════════════════════════════════════════
   SEED SAMPLE ORDERS (demo data for kitchen view)
═══════════════════════════════════════════════════ */
window.addEventListener('load', () => {
    const now = Date.now() - 6 * 60000;
    orders = [
        {
            id: nextOrderId++, table: 'A1',
            item: 'Iced Green Tea', qty: 2, notes: '—',
            status: 'new', paymentStatus: 'unpaid', type: 'drinks',
            createdAt: now,
        },
        {
            id: nextOrderId++, table: 'B4',
            item: 'Original Tonkotsu', qty: 1,
            notes: 'Noodles: Thin straight · Firmness: Firm · Saltiness: Rich · Toppings: Soft-boiled egg',
            status: 'prep', paymentStatus: 'paid', type: 'food',
            createdAt: now - 3 * 60000,
        },
        {
            id: nextOrderId++, table: 'C2',
            item: 'Spicy Miso Ramen', qty: 2,
            notes: 'Noodles: Medium wavy · Firmness: Normal · Saltiness: Regular · Toppings: None',
            status: 'done', paymentStatus: 'paid', type: 'food',
            createdAt: now - 8 * 60000,
        },
    ];
});
window.addEventListener('load', () => {
    const url = new URL(window.location.href);
    const payment = url.searchParams.get("payment");
    const orderId = url.searchParams.get("orderId");

    let isPaymentReturn = false;

    if (payment === "success") {
        processOrder('paid', orderId);
        isPaymentReturn = true;
    }

    if (payment === "fail") {
        showToast('Payment failed!', true);
        isPaymentReturn = true;
    }

    if (payment === "invalid") {
        showToast('Payment verification failed!', true);
        isPaymentReturn = true;
    }

    if (isPaymentReturn) {
        showPage('order', document.querySelector('.nav-links a:nth-child(3)'));
        // Xóa tham số trên URL để tránh chạy lại khi refresh
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});