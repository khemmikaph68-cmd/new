/* admin-booking.js (Fixed: Sync Status with Monitor Logic & Dynamic Slots) */

let bookingModal;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Init Modal
    const modalEl = document.getElementById('bookingModal');
    if (modalEl) bookingModal = new bootstrap.Modal(modalEl);

    // 2. Set Default Date
    const dateFilter = document.getElementById('bookingDateFilter');
    if (dateFilter) dateFilter.valueAsDate = new Date();

    // 3. Render Table
    renderBookings();
    
    // 4. Init Form Options (โหลด PC และ Time Slots ลง Select)
    initFormOptions();
});

// ==========================================
// 0. INIT FORM OPTIONS (ส่วนที่เพิ่มใหม่)
// ==========================================
function initFormOptions() {
    // 1.1 Load PCs into Modal Select
    const pcSelect = document.getElementById('inputPcId');
    if (pcSelect) {
        const pcs = DB.getPCs();
        // เรียงตามชื่อเครื่อง
        pcs.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
        
        pcSelect.innerHTML = '<option value="">-- เลือกเครื่อง --</option>';
        pcs.forEach(pc => {
            const statusText = pc.status === 'maintenance' ? '(ปิดปรับปรุง)' : '';
            const disableAttr = pc.status === 'maintenance' ? 'disabled' : '';
            pcSelect.innerHTML += `<option value="${pc.id}" ${disableAttr}>${pc.name} ${statusText}</option>`;
        });
    }

    // 1.2 Load Time Slots (Dynamic from DB)
    const timeSelect = document.getElementById('inputTimeSlot');
    if (timeSelect) {
        // ใช้ฟังก์ชัน getAiTimeSlots จาก mock-db.js
        const slots = (DB.getAiTimeSlots && typeof DB.getAiTimeSlots === 'function') 
                      ? DB.getAiTimeSlots() 
                      : [];
        
        const activeSlots = slots.filter(s => s.active);
        
        timeSelect.innerHTML = '<option value="">-- เลือกรอบเวลา --</option>';
        
        if (activeSlots.length > 0) {
            activeSlots.forEach(s => {
                const label = s.label || `${s.start} - ${s.end}`;
                // value เก็บเป็น JSON string เพื่อให้ตอน save แกะค่า start/end ได้ง่าย
                timeSelect.innerHTML += `<option value='${JSON.stringify({start: s.start, end: s.end})}'>${label}</option>`;
            });
        } else {
            timeSelect.innerHTML += `<option value="" disabled>ไม่มีรอบเวลาที่เปิดใช้งาน</option>`;
        }
    }
}

// ==========================================
// 1. RENDER TABLE
// ==========================================
function renderBookings() {
    const tbody = document.getElementById('bookingTableBody');
    if(!tbody) return;

    const bookings = DB.getBookings();
    const filterDate = document.getElementById('bookingDateFilter').value;
    const filterStatus = document.getElementById('bookingStatusFilter').value;

    tbody.innerHTML = '';

    const filtered = bookings.filter(b => {
        if (filterDate && b.date !== filterDate) return false;
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">ไม่มีรายการจองตามเงื่อนไข</td></tr>`;
        return;
    }

    filtered.sort((a, b) => {
        // เรียงลำดับความสำคัญสถานะ
        const priority = { 'approved': 1, 'pending': 2, 'completed': 3, 'no_show': 4, 'rejected': 5 };
        const statusDiff = (priority[a.status] || 99) - (priority[b.status] || 99);
        if (statusDiff !== 0) return statusDiff;
        return a.startTime.localeCompare(b.startTime);
    });

    filtered.forEach(b => {
        let badgeClass = '', statusText = '', actionBtns = '';

        switch(b.status) {
            case 'pending':
                badgeClass = 'bg-warning text-dark'; statusText = 'รออนุมัติ';
                actionBtns = `
                    <button class="btn btn-sm btn-success me-1" onclick="updateStatus('${b.id}', 'approved')"><i class="bi bi-check-lg"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="updateStatus('${b.id}', 'rejected')"><i class="bi bi-x-lg"></i></button>`;
                break;
            
            case 'approved':
                badgeClass = 'bg-primary text-white'; statusText = 'อนุมัติแล้ว (Approved)';
                actionBtns = `
                    <button class="btn btn-sm btn-outline-secondary me-1" onclick="updateStatus('${b.id}', 'no_show')" title="แจ้ง No Show"><i class="bi bi-person-x"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="updateStatus('${b.id}', 'rejected')" title="ยกเลิก"><i class="bi bi-trash"></i></button>
                `;
                break;
            
            case 'completed':
                badgeClass = 'bg-success'; statusText = 'ใช้งานเสร็จสิ้น'; break;
            case 'no_show':
                badgeClass = 'bg-secondary'; statusText = 'No Show'; break;
            case 'rejected':
                badgeClass = 'bg-secondary'; statusText = 'ยกเลิกแล้ว'; break;
        }

        let softwareDisplay = '-';
        if (b.softwareList && b.softwareList.length > 0) {
            softwareDisplay = b.softwareList.map(sw => `<span class="badge bg-info text-dark border border-info bg-opacity-25 me-1">${sw}</span>`).join('');
        } else if (b.type === 'General') {
            softwareDisplay = '<span class="badge bg-light text-secondary border">ทั่วไป</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold text-primary ps-4">${b.startTime} - ${b.endTime}</td>
            <td><div class="fw-bold">${b.userName}</div><div class="small text-muted">${b.userId}</div></td>
            <td><span class="badge bg-light text-dark border">${b.pcName}</span></td>
            <td>${softwareDisplay}</td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td class="text-end pe-4">${actionBtns}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateStatus(id, newStatus) {
    let bookings = DB.getBookings();
    const index = bookings.findIndex(b => b.id === id);
    if (index !== -1) {
        const booking = bookings[index];
        booking.status = newStatus;
        DB.saveBookings(bookings);
        
        // ถ้าเป็นการยกเลิก หรือ No Show ให้คืนสถานะเครื่อง PC เป็นว่างด้วย (ถ้าเครื่องยังสถานะ reserved อยู่)
        if (newStatus === 'no_show' || newStatus === 'rejected') {
            const pcs = DB.getPCs();
            const pc = pcs.find(p => String(p.id) === String(booking.pcId));
            if (pc && pc.status === 'reserved' && pc.currentUser === booking.userName) {
                DB.updatePCStatus(booking.pcId, 'available', null);
            }
        }
        renderBookings();
    }
}

// ==========================================
// 2. MODAL & FORM LOGIC
// ==========================================

function openBookingModal() {
    // Reset Form
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inputDate').value = today;
    document.getElementById('inputPcId').value = '';
    document.getElementById('inputTimeSlot').value = ''; // Reset Time Slot
    document.getElementById('inputUserId').value = '';
    document.getElementById('inputUserName').value = '';
    document.getElementById('inputNote').value = '';
    
    if(bookingModal) bookingModal.show();
}

function saveBooking() {
    const pcId = document.getElementById('inputPcId').value;
    const date = document.getElementById('inputDate').value; // yyyy-mm-dd
    const timeSlotJson = document.getElementById('inputTimeSlot').value;
    const userId = document.getElementById('inputUserId').value.trim();
    const userName = document.getElementById('inputUserName').value.trim();
    const note = document.getElementById('inputNote').value.trim();

    if (!pcId || !date || !timeSlotJson || !userName) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }

    // แกะ Time Slot จาก JSON Value
    let slot;
    try {
        slot = JSON.parse(timeSlotJson);
    } catch (e) {
        alert("เกิดข้อผิดพลาดในการอ่านค่าเวลา");
        return;
    }

    const pcs = DB.getPCs();
    const pc = pcs.find(p => String(p.id) === String(pcId));

    // เช็คซ้ำ (Conflict Check)
    const bookings = DB.getBookings();
    const isDup = bookings.some(b => 
        b.date === date && b.pcId === pcId && 
        ['approved', 'in_use'].includes(b.status) &&
        ((slot.start >= b.startTime && slot.start < b.endTime) || (slot.end > b.startTime && slot.end <= b.endTime))
    );

    if (isDup) {
        alert("⚠️ ช่วงเวลานี้มีการจองอยู่แล้ว กรุณาเลือกเครื่องอื่นหรือเวลาอื่น");
        return;
    }

    const newBooking = {
        id: 'b_admin_' + Date.now(),
        userId: userId || 'Guest',
        userName: userName,
        pcId: pcId,
        pcName: pc ? pc.name : 'Unknown',
        date: date,
        startTime: slot.start,
        endTime: slot.end,
        note: note,
        status: 'approved', // จองโดย Admin ให้ Approve เลย
        type: 'General' // Default type
    };

    bookings.push(newBooking);
    DB.saveBookings(bookings);
    
    alert(`✅ บันทึกการจองสำเร็จ`);
    if(bookingModal) bookingModal.hide();
    renderBookings();
}

function deleteBooking(id) {
    if(!confirm("ยืนยันลบข้อมูลการจองนี้?")) return;
    let bookings = DB.getBookings();
    bookings = bookings.filter(b => b.id !== id);
    DB.saveBookings(bookings);
    renderBookings();
}

// ==========================================
// 3. IMPORT CSV LOGIC (Fixed)
// ==========================================

function handleImport(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        processCSVData(e.target.result);
    };
    reader.readAsText(file);
    input.value = ''; // Reset input
}

function processCSVData(csvText) {
    // 1. ดึงวันที่จากตัวกรองหน้าเว็บมาใช้ (Import ลงวันที่ที่เลือก)
    const selectedDate = document.getElementById('bookingDateFilter').value;
    if (!selectedDate) {
        alert("❌ กรุณาเลือก 'วันที่' ในหน้าเว็บก่อน Import ไฟล์");
        return;
    }

    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
    // ลบ Header ออก 1 บรรทัด
    const dataLines = lines.slice(1);

    if (dataLines.length === 0) {
        alert("❌ ไม่พบข้อมูลในไฟล์ CSV");
        return;
    }

    const bookings = DB.getBookings();
    const pcs = DB.getPCs();
    let successCount = 0;
    let failCount = 0;
    let errorLog = [];

    dataLines.forEach((line, index) => {
        // Format Expected: Time, User, PC, Note, Status
        // Example: 09:00-10:30, สมชาย, PC-01, ChatGPT, approved
        
        const cols = line.split(',');
        if (cols.length < 5) {
            failCount++;
            errorLog.push(`แถว ${index + 2}: ข้อมูลไม่ครบ (ต้องมี Time, User, PC, Note, Status)`);
            return;
        }

        const [timeRange, userRaw, pcNameRaw, noteRaw, statusRaw] = cols.map(c => c.trim());

        // A. จัดการเวลา (Time) -> แยก Start/End
        const times = timeRange.split('-');
        if (times.length !== 2) {
            failCount++;
            errorLog.push(`แถว ${index + 2}: รูปแบบเวลาผิด (ต้องเป็น HH:mm-HH:mm)`);
            return;
        }
        const startTime = times[0].trim();
        const endTime = times[1].trim();

        // B. จัดการ PC -> หา ID จากชื่อเครื่อง
        const cleanPcName = pcNameRaw.toUpperCase().replace('PC-', ''); 
        const pc = pcs.find(p => String(p.id) === cleanPcName || p.name === pcNameRaw);
        
        if (!pc) {
            failCount++;
            errorLog.push(`แถว ${index + 2}: ไม่พบเครื่องชื่อ "${pcNameRaw}"`);
            return;
        }

        // C. จัดการ Note / Software
        let softwareList = [];
        let type = 'General';
        if (noteRaw && noteRaw.toLowerCase() !== 'general') {
            softwareList = noteRaw.split(';').map(s => s.trim());
            type = 'AI';
        }

        // D. ตรวจสอบสถานะ (Status)
        const validStatuses = ['pending', 'approved', 'completed', 'no_show', 'rejected'];
        let status = statusRaw.toLowerCase();
        if (!validStatuses.includes(status)) status = 'approved';

        // E. สร้าง Object การจอง
        const newBooking = {
            id: 'b_imp_' + Date.now() + Math.random().toString(36).substr(2, 5),
            userId: userRaw,   // ใช้ชื่อเป็น ID ชั่วคราว
            userName: userRaw,
            pcId: pc.id,
            pcName: pc.name,
            date: selectedDate, // ใช้วันที่จากหน้าเว็บ
            startTime: startTime,
            endTime: endTime,
            type: type,
            softwareList: softwareList, 
            status: status
        };

        // F. ตรวจสอบเวลาชน (Conflict Check)
        const conflict = bookings.find(b => {
            return String(b.pcId) === String(pc.id) && 
                   b.date === selectedDate && 
                   ['approved', 'in_use'].includes(b.status) &&
                   (startTime < b.endTime && endTime > b.startTime);
        });

        if (conflict) {
            failCount++;
            errorLog.push(`แถว ${index + 2}: เวลาชนกับ ${conflict.userName} (${conflict.startTime}-${conflict.endTime})`);
            return;
        }

        bookings.push(newBooking);
        successCount++;
    });

    // บันทึกและรีเฟรช
    if (successCount > 0) {
        DB.saveBookings(bookings);
        renderBookings();
        alert(`✅ นำเข้าข้อมูลวันที่ ${selectedDate} เรียบร้อย!\nสำเร็จ: ${successCount}\nล้มเหลว: ${failCount}`);
    } else {
        alert(`❌ นำเข้าล้มเหลวทั้งหมด\n\n${errorLog.join('\n')}`);
    }
}