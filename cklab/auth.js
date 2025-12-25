/* auth.js - Kiosk Logic (Final: Real-time Status, Popup & Contact Info) */

function getSystemPCId() {
    if (window.location.hash) {
        let id = window.location.hash.replace('#', '').replace(/pc-/i, '');
        return parseInt(id).toString();
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('pc');
}

const FIXED_PC_ID = getSystemPCId(); 

let verifiedUserData = null;
let activeTab = 'internal';
let lastLabStatus = null; 
let lastAdminMessage = null;
let labClosedModal = null; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. เช็ค DB
    if (typeof DB === 'undefined') {
        document.body.innerHTML = '<div class="alert alert-danger m-5 text-center"><h3>❌ Error</h3><p>ไม่พบฐานข้อมูล (DB is not defined)</p></div>';
        return;
    }

    // 2. เตรียม Modal แจ้งเตือนปิดห้อง
    const modalEl = document.getElementById('labClosedModal');
    if (modalEl) {
        labClosedModal = new bootstrap.Modal(modalEl);
    }

    // 3. เริ่มเช็คสถานะห้อง (ทำทันที + ทำซ้ำทุก 2 วิ)
    monitorLabStatus();
    setInterval(monitorLabStatus, 2000);

    // 4. ถ้าห้องปิด ไม่ต้องรันต่อ (ให้ monitorLabStatus จัดการเปิด Modal เอง)
    const config = DB.getGeneralConfig();
    if (config && config.labStatus === 'closed') {
        return; 
    }

    // 5. เช็ค PC ID
    if (!FIXED_PC_ID || isNaN(parseInt(FIXED_PC_ID))) {
        renderNoPcIdError();
        return;
    }

    checkMachineStatus();
    
    // Bind Events
    const extInputs = document.querySelectorAll('#formExternal input');
    if(extInputs.length > 0) extInputs.forEach(input => input.addEventListener('input', validateForm));
    
    const ubuInput = document.getElementById('ubuUser');
    if(ubuInput) ubuInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') verifyUBUUser(); });
});

// ✅✅✅ ฟังก์ชันเช็คสถานะห้อง & ข้อมูลติดต่อ ✅✅✅
function monitorLabStatus() {
    const config = DB.getGeneralConfig();
    if (!config) return;

    const currentStatus = config.labStatus || 'open';
    const currentMessage = config.adminMessage || 'ขออภัยในความไม่สะดวก';

    // 1. อัปเดตชื่อห้อง
    if(document.getElementById('displayLabName')) document.getElementById('displayLabName').innerText = config.labName;
    if(document.getElementById('displayLocation')) document.getElementById('displayLocation').innerText = config.labLocation;

    // 2. อัปเดตข้อมูลติดต่อ (Admin On Duty)
    const contactSection = document.getElementById('contactInfoSection');
    if (contactSection) {
        if (config.adminOnDuty || config.contactPhone) {
            contactSection.classList.remove('d-none');
            
            const adminNameEl = document.getElementById('displayAdminOnDuty');
            if(adminNameEl) adminNameEl.innerText = config.adminOnDuty || 'เจ้าหน้าที่ประจำห้อง';
            
            const phoneEl = document.getElementById('displayContactPhone');
            if(phoneEl) phoneEl.innerText = config.contactPhone || '-';
        } else {
            contactSection.classList.add('d-none');
        }
    }

    // 3. ตรวจสอบสถานะ เปิด/ปิด
    if (currentStatus === 'closed') {
        // อัปเดตข้อความใน Modal
        const msgEl = document.getElementById('modalClosedMessage');
        if (msgEl) msgEl.innerText = currentMessage;

        // สั่งเปิด Popup (ถ้ายังไม่เปิด)
        if (labClosedModal) {
            const el = document.getElementById('labClosedModal');
            if (!el.classList.contains('show')) {
                labClosedModal.show();
            }
        }
    } 
    else if (currentStatus === 'open') {
        // ถ้าก่อนหน้านี้ปิดอยู่ -> สั่งปิด Modal และรีเฟรชหน้า
        if (lastLabStatus === 'closed') {
            if (labClosedModal) labClosedModal.hide();
            window.location.reload(); 
        }
    }

    // จำค่าล่าสุด
    lastLabStatus = currentStatus;
    lastAdminMessage = currentMessage;
}

function renderNoPcIdError() {
    document.body.innerHTML = `
        <div class="d-flex justify-content-center align-items-center vh-100 flex-column text-center bg-light">
            <div class="card border-0 shadow p-5 rounded-4">
                <h2 class="fw-bold text-dark">⚠️ Setup Error</h2>
                <p class="text-muted mb-4">ไม่พบหมายเลขเครื่องใน URL<br>กรุณาเข้าผ่านลิงก์เช่น: <code>index.html?pc=1</code></p>
                <a href="index.html?pc=1" class="btn btn-primary px-4 py-2 fw-bold rounded-pill">จำลองเข้าเครื่องที่ 1</a>
            </div>
        </div>
    `;
}

// ... (ฟังก์ชันอื่นๆ เหมือนเดิม ก๊อปปี้ต่อท้ายได้เลยครับ) ...

function checkMachineStatus() {
    const displayId = document.getElementById('fixedPcIdDisplay');
    if(displayId) {
        displayId.innerText = `PC-${FIXED_PC_ID.toString().padStart(2, '0')}`;
        displayId.className = 'fw-bold text-primary';
    }

    const pc = DB.getPCs().find(p => String(p.id) === String(FIXED_PC_ID));
    
    if (!pc) return; 
    
    const indicator = document.querySelector('.status-indicator');
    if(indicator) {
        indicator.className = 'status-indicator rounded-circle d-inline-block';
        indicator.style.width = '10px';
        indicator.style.height = '10px';
        indicator.style.marginRight = '6px';
        
        if(pc.status === 'available') indicator.classList.add('bg-success');
        else if(pc.status === 'in_use') indicator.classList.add('bg-danger');
        else if(pc.status === 'reserved') indicator.classList.add('bg-warning');
        else indicator.classList.add('bg-secondary');
    }

    // Auto Resume Session
    if (pc.status === 'in_use' && lastLabStatus === 'open') {
         const currentSession = DB.getSession();
         if (!currentSession || String(currentSession.pcId) !== String(FIXED_PC_ID)) {
              DB.setSession({
                   pcId: FIXED_PC_ID,
                   user: { name: pc.currentUser || 'Unknown User' },
                   startTime: pc.startTime || Date.now(),
                   forceEndTime: pc.forceEndTime || null 
              });
         }
         window.location.href = 'timer.html';
    } 
}

function switchTab(type) {
    activeTab = type;
    verifiedUserData = null;
    const btnInt = document.getElementById('tab-internal');
    const btnExt = document.getElementById('tab-external');
    if(type === 'internal') {
        if(btnInt) btnInt.classList.add('active'); 
        if(btnExt) btnExt.classList.remove('active');
        document.getElementById('formInternal').classList.remove('d-none');
        document.getElementById('formExternal').classList.add('d-none');
        document.getElementById('ubuUser').value = '';
        document.getElementById('internalVerifyCard').classList.add('d-none');
    } else {
        if(btnExt) btnExt.classList.add('active'); 
        if(btnInt) btnInt.classList.remove('active');
        document.getElementById('formExternal').classList.remove('d-none');
        document.getElementById('formInternal').classList.add('d-none');
    }
    validateForm();
}

function verifyUBUUser() {
    const input = document.getElementById('ubuUser');
    const id = input.value.trim();
    if(!id) { input.focus(); return; }
    const user = DB.checkRegAPI(id);
    const verifyCard = document.getElementById('internalVerifyCard');
    if (user) {
        verifiedUserData = { id: id, name: user.prefix + user.name, faculty: user.faculty, role: user.role };
        document.getElementById('showName').innerText = verifiedUserData.name;
        document.getElementById('showFaculty').innerText = verifiedUserData.faculty;
        const roleEl = document.getElementById('showRole');
        if(roleEl) roleEl.innerText = verifiedUserData.role.toUpperCase();
        
        verifyCard.classList.remove('d-none');
        validateForm();
    } else {
        alert("❌ ไม่พบข้อมูลในระบบ");
        verifyCard.classList.add('d-none');
        verifiedUserData = null;
        input.value = ''; input.focus(); validateForm();
    }
}

function validateForm() {
    let isUserValid = false;
    const btn = document.getElementById('btnConfirm');
    if (!btn) return;

    if (activeTab === 'internal') isUserValid = (verifiedUserData !== null);
    else {
        const id = document.getElementById('extIdCard').value.trim();
        const name = document.getElementById('extName').value.trim();
        isUserValid = (id !== '' && name !== '');
    }
    const pc = DB.getPCs().find(p => String(p.id) === String(FIXED_PC_ID));
    const isAccessible = pc && (pc.status === 'available' || pc.status === 'reserved');
    if (isUserValid && isAccessible) {
        btn.disabled = false;
        btn.className = 'btn btn-success w-100 py-3 fw-bold shadow-sm rounded-3 transition-btn';
        if (pc.status === 'reserved') btn.innerHTML = `<i class="bi bi-calendar-check me-2"></i>ยืนยันการเข้าใช้งาน (มีคิวจอง)`;
        else btn.innerHTML = `<i class="bi bi-box-arrow-in-right me-2"></i>เข้าสู่ระบบและเริ่มใช้งาน`;
    } else {
        btn.disabled = true;
        btn.className = 'btn btn-secondary w-100 py-3 fw-bold shadow-sm rounded-3 transition-btn';
        if (!isAccessible) btn.innerHTML = `<i class="bi bi-x-circle me-2"></i>เครื่องไม่ว่าง (${pc ? pc.status : 'Error'})`;
        else btn.innerHTML = `<i class="bi bi-box-arrow-in-right me-2"></i>เข้าสู่ระบบและเริ่มใช้งาน`;
    }
}

function confirmCheckIn() {
    const config = DB.getGeneralConfig();
    if (config.labStatus === 'closed') {
        alert("⛔ ระบบปิดให้บริการแล้ว");
        monitorLabStatus(); 
        return; 
    }
    if (!verifiedUserData && activeTab === 'internal') return;
    if (activeTab === 'external') {
        verifiedUserData = {
            id: document.getElementById('extIdCard').value.trim(),
            name: document.getElementById('extName').value.trim(),
            faculty: document.getElementById('extOrg').value.trim() || 'บุคคลทั่วไป',
            role: 'external'
        };
    }
    const pcId = FIXED_PC_ID; 
    const now = new Date();
    const currentHm = now.getHours() * 60 + now.getMinutes();
    let currentSlot = null;
    const allSlots = (DB.getAiTimeSlots && typeof DB.getAiTimeSlots === 'function') ? DB.getAiTimeSlots() : [];
    const activeSlots = allSlots.filter(s => s.active);
    activeSlots.forEach(slot => {
        const [sh, sm] = slot.start.split(':').map(Number);
        const [eh, em] = slot.end.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        if (currentHm >= (startMins - 15) && currentHm < endMins) currentSlot = { ...slot, endMins }; 
    });
    
    // AI Slot Check
    const pcInfo = DB.getPCs().find(p => String(p.id) === String(pcId));
    if (pcInfo && pcInfo.pcType === 'AI' && !currentSlot) {
         let availableTimes = activeSlots.map(s => s.label || `${s.start}-${s.end}`).join('\n- ');
         if (!availableTimes) availableTimes = "ไม่มีรอบเปิดให้บริการขณะนี้";
         alert(`⛔ เครื่องนี้ (AI Station) ไม่อยู่ในช่วงเวลาให้บริการ\n\nรอบที่เปิดให้บริการ:\n- ${availableTimes}`);
         return; 
    }

    // Auto-Detect Booking
    const bookings = DB.getBookings(); 
    const todayStr = new Date().toLocaleDateString('en-CA');
    const validBooking = bookings.find(b => String(b.pcId) === String(pcId) && b.date === todayStr && b.status === 'approved' && b.userName === verifiedUserData.name);
    let usageDetail = 'Walk-in User';
    
    if (validBooking) {
        const [startH, startM] = validBooking.startTime.split(':').map(Number);
        const bookingStartMins = startH * 60 + startM;
        if (currentHm < (bookingStartMins - 15)) {
             if(!confirm(`⚠️ คุณมาก่อนเวลาจองเกิน 15 นาที\nกด OK เพื่อเข้าใช้งานแบบ Walk-in ก่อน\nกด Cancel เพื่อรอเวลา`)) return;
        } else {
             usageDetail = 'Check-in from Booking';
             DB.updateBookingStatus(validBooking.id, 'completed');
        }
    } else if (pcInfo.status === 'reserved') {
        alert(`⛔ เครื่องนี้ถูกจองไว้โดยผู้อื่น`);
        return;
    }

    const forceEndTime = currentSlot ? currentSlot.endMins : null;
    const sessionData = {
        user: { id: verifiedUserData.id, name: verifiedUserData.name, role: verifiedUserData.role, faculty: verifiedUserData.faculty },
        pcId: pcId, startTime: Date.now(), forceEndTime: forceEndTime, slotId: currentSlot ? currentSlot.id : null
    };
    DB.setSession(sessionData); 
    DB.updatePCStatus(pcId, 'in_use', verifiedUserData.name, { forceEndTime: forceEndTime }); 
    DB.saveLog({
        action: 'START_SESSION',
        userId: verifiedUserData.id, userName: verifiedUserData.name, userRole: verifiedUserData.role, userFaculty: verifiedUserData.faculty,
        pcId: pcId, startTime: new Date().toISOString(), details: usageDetail,
        slotId: currentSlot ? (currentSlot.label || currentSlot.id) : null 
    });
    window.location.href = 'timer.html';
}