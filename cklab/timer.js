/* timer.js (Final Version: User Extend + Admin Sync) */

let timerInterval; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. เช็ค DB
    if (typeof DB === 'undefined') {
        document.body.innerHTML = '<div class="alert alert-danger m-5 text-center"><h3>❌ Error</h3><p>ไม่พบฐานข้อมูล (DB is not defined)</p></div>';
        return;
    }

    // 2. เช็ค Session
    const session = DB.getSession();
    if (!session || !session.startTime) {
        alert('⚠️ ไม่พบข้อมูลการใช้งาน กรุณาลงชื่อเข้าใช้ใหม่');
        window.location.href = 'index.html';
        return;
    }

    // 3. แสดงข้อมูล
    const userName = session.user ? session.user.name : 'ผู้ใช้ไม่ระบุชื่อ';
    document.getElementById('userNameDisplay').innerText = userName;
    
    const pcIdDisplay = session.pcId ? session.pcId.toString().padStart(2,'0') : '??';
    document.getElementById('pcNameDisplay').innerText = `Station: PC-${pcIdDisplay}`;
    
    // 4. เลือกโหมดจับเวลา
    if (session.forceEndTime) {
        console.log("Mode: Countdown (Slot-based)");
        document.getElementById('timerLabel').innerText = "เวลาที่เหลือในรอบนี้ (Remaining Time)";
        
        // เริ่มนับถอยหลัง
        updateCountdownSlot(); 
        timerInterval = setInterval(updateCountdownSlot, 1000); 
        
        // ✅ เริ่มระบบ Sync กับ Admin (เฉพาะโหมด AI Slot)
        setInterval(syncWithAdminUpdates, 5000);

    } else {
        console.log("Mode: Normal Timer (Elapsed)");
        // ซ่อนปุ่มต่อเวลา (เพราะใช้ได้เรื่อยๆ อยู่แล้ว)
        const btnExtend = document.getElementById('btnExtend');
        if(btnExtend) btnExtend.style.display = 'none'; 
        
        // เริ่มจับเวลาเดินหน้า
        updateTimer(); 
        timerInterval = setInterval(updateTimer, 1000); 
        
        // ยังคง Sync เผื่อโดน Force Logout
        setInterval(syncWithAdminUpdates, 5000);
    }
});

// --- Mode 1: จับเวลาเดินหน้า (General Use) ---
function updateTimer() {
    const session = DB.getSession(); 
    if (!session) return;
    const now = Date.now();
    let diff = now - session.startTime;
    if (diff < 0) diff = 0;
    document.getElementById('timerDisplay').innerText = formatTime(diff);
}

// --- Mode 2: นับถอยหลัง (AI Slot Use) ---
function updateCountdownSlot() {
    const session = DB.getSession();
    if (!session) return;

    // คำนวณเวลาเป้าหมาย (forceEndTime เป็นนาทีจากเที่ยงคืน)
    const endMinutesTotal = session.forceEndTime; 
    const targetDate = new Date();
    const targetHour = Math.floor(endMinutesTotal / 60);
    const targetMin = endMinutesTotal % 60;
    targetDate.setHours(targetHour, targetMin, 0, 0);

    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
        if (timerInterval) clearInterval(timerInterval);
        document.getElementById('timerDisplay').innerText = "00:00:00";
        document.getElementById('timerDisplay').classList.add('text-danger', 'fw-bold');
        
        // 🚨 หมดเวลา -> ถามต่อเวลา
        setTimeout(() => {
            handleTimeUp();
        }, 500);
        return;
    }

    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) {
        timerDisplay.innerText = formatTime(diff);

        // เตือนช่วง 5 นาทีสุดท้าย
        if (diff < 5 * 60 * 1000) { 
            timerDisplay.style.color = '#dc3545'; 
            showAlert('ใกล้หมดเวลาแล้ว! กรุณาเตรียมตัวบันทึกงาน หรือกด "ขอต่อเวลา"');
            
            // กระพริบถ้าน้อยกว่า 1 นาที
            if (diff < 60 * 1000) {
                timerDisplay.style.opacity = (new Date().getMilliseconds() < 500) ? '1' : '0.5';
            }
        } else {
            timerDisplay.style.color = ''; 
            timerDisplay.style.opacity = '1';
            hideAlert();
        }
    }
}

// ✅✅✅ ฟังก์ชัน Sync ข้อมูลกับ Admin (สำคัญ!) ✅✅✅
function syncWithAdminUpdates() {
    const session = DB.getSession(); 
    if (!session || !session.pcId) return;

    // อ่านข้อมูลล่าสุดจาก DB
    const pcs = DB.getPCs();
    const pc = pcs.find(p => String(p.id) === String(session.pcId));

    if (pc) {
        // กรณี 1: โดน Force Logout หรือสถานะเปลี่ยน
        if (pc.status !== 'in_use' || pc.currentUser !== session.user.name) {
            alert("⚠️ Admin ได้ทำการรีเซ็ตเครื่องหรือเช็คเอาท์ให้คุณแล้ว");
            DB.clearSession();
            window.location.href = 'index.html';
            return;
        }

        // กรณี 2: Admin ต่อเวลาให้ (forceEndTime เปลี่ยน)
        // (เช็คเฉพาะถ้ามีค่าทั้งคู่ และไม่เท่ากัน)
        if (pc.forceEndTime && session.forceEndTime && pc.forceEndTime !== session.forceEndTime) {
            console.log("Time updated by Admin!");
            
            // อัปเดต Session ฝั่ง User ให้ตรงกับ DB
            session.forceEndTime = pc.forceEndTime;
            DB.setSession(session);

            // รีเซ็ตหน้าจอ
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateCountdownSlot, 1000);
            updateCountdownSlot(); 
            
            // แจ้งเตือนเล็กน้อย (Optional)
            hideAlert();
            // alert("Admin ได้ปรับปรุงเวลาใช้งานให้คุณแล้ว");
        }
    }
}

// ✅✅✅ ฟังก์ชันขอต่อเวลา (User กดเอง) ✅✅✅
function tryExtendSession() {
    const session = DB.getSession();
    if (!session || !session.forceEndTime) {
        alert("ไม่สามารถต่อเวลาได้ในโหมดนี้");
        return;
    }

    const currentEndTime = session.forceEndTime; 
    
    // 1. หารอบถัดไป
    const allSlots = DB.getAiTimeSlots ? DB.getAiTimeSlots() : [];
    const activeSlots = allSlots.filter(s => s.active);
    
    const endH = Math.floor(currentEndTime / 60).toString().padStart(2, '0');
    const endM = (currentEndTime % 60).toString().padStart(2, '0');
    const timeString = `${endH}:${endM}`;

    const nextSlot = activeSlots.find(s => s.start === timeString);

    if (!nextSlot) {
        alert("⛔ ไม่สามารถต่อเวลาได้: ไม่มีรอบให้บริการถัดไป หรือห้องปิดแล้ว");
        return;
    }

    // 2. เช็ค Booking ชนไหม
    const bookings = DB.getBookings();
    const todayStr = new Date().toLocaleDateString('en-CA');
    
    const conflict = bookings.find(b => 
        String(b.pcId) === String(session.pcId) &&
        b.date === todayStr &&
        ['approved', 'pending'].includes(b.status) &&
        b.startTime === nextSlot.start 
    );

    if (conflict) {
        alert(`⛔ ไม่สามารถต่อเวลาได้: มีการจองโดยคุณ ${conflict.userName} ในรอบถัดไป (${nextSlot.start} - ${nextSlot.end})`);
        return;
    }

    // 3. ยืนยันและบันทึก
    if(confirm(`✅ รอบถัดไปว่าง (${nextSlot.start} - ${nextSlot.end})\nคุณต้องการต่อเวลาใช้งานหรือไม่?`)) {
        
        const [nextEh, nextEm] = nextSlot.end.split(':').map(Number);
        const newForceEndTime = nextEh * 60 + nextEm;

        // อัปเดต Session
        session.forceEndTime = newForceEndTime;
        session.slotId = nextSlot.id;
        DB.setSession(session);

        // อัปเดต DB
        DB.updatePCStatus(session.pcId, 'in_use', session.user.name, { forceEndTime: newForceEndTime });

        // Log
        DB.saveLog({
            action: 'EXTEND_SESSION',
            userId: session.user.id,
            userName: session.user.name,
            pcId: session.pcId,
            details: `User Extended to slot: ${nextSlot.start}-${nextSlot.end}`
        });

        alert("🎉 ต่อเวลาสำเร็จ! ใช้งานได้จนถึง " + nextSlot.end);
        
        // Reset Timer
        hideAlert();
        document.getElementById('timerDisplay').style.color = '';
        document.getElementById('timerDisplay').style.opacity = '1';
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(updateCountdownSlot, 1000);
        updateCountdownSlot();
    }
}

// ฟังก์ชันเมื่อเวลาหมด
function handleTimeUp() {
    if(confirm("⏰ หมดเวลาการใช้งานในรอบนี้แล้ว\n\nกด 'OK' เพื่อขอต่อเวลา (ถ้าว่าง)\nกด 'Cancel' เพื่อเลิกใช้งาน")) {
        tryExtendSession();
    } else {
        doCheckout(true);
    }
}

// --- Helpers ---
function formatTime(ms) {
    const h = Math.floor(ms / 3600000).toString().padStart(2, '0');
    const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function showAlert(msg) {
    const box = document.getElementById('alertBox');
    const txt = document.getElementById('alertMsg');
    if(box && txt) {
        box.classList.remove('d-none');
        txt.innerText = msg;
    }
}

function hideAlert() {
    const box = document.getElementById('alertBox');
    if(box) box.classList.add('d-none');
}

function doCheckout(isAuto = false) {
    if (!isAuto && !confirm('คุณต้องการเลิกใช้งานและออกจากระบบใช่หรือไม่?')) return;
    if (timerInterval) clearInterval(timerInterval);

    const session = DB.getSession();
    if (!session) { window.location.href = 'index.html'; return; }

    const endTime = Date.now();
    const durationMilliseconds = endTime - session.startTime;
    const durationMinutes = Math.round(durationMilliseconds / 60000); 

    session.durationMinutes = durationMinutes; 
    DB.setSession(session);
    
    // เปลี่ยนไปหน้า Feedback
    window.location.href = 'feedback.html';
}

function forceLogout() {
    if (timerInterval) clearInterval(timerInterval);
    const session = DB.getSession(); 
    if (!session) { window.location.href = 'index.html'; return; }
    
    DB.saveLog({
        action: 'Force Check-out',
        userId: session.user.id || 'N/A',
        userName: session.user.name || 'N/A',
        pcId: session.pcId,
        startTime: new Date(session.startTime).toISOString(),
        timestamp: new Date().toISOString(),
        durationMinutes: 0, 
        satisfactionScore: 'N/A',
    });

    DB.updatePCStatus(session.pcId, 'available', null);
    DB.clearSession();
    alert("❌ ระบบทำการล็อคเอาท์ฉุกเฉินแล้ว");
    window.location.href = 'index.html';
}