/* admin-report.js (Final Fix: Table Update & Pagination Reset) */

// --- Global Variables ---
let monthlyFacultyChartInstance, monthlyOrgChartInstance;
let pieChartInstance, pcAvgChartInstance, topSoftwareChartInstance;
let allLogs = [];
let lastLogCount = 0;

// ✅ Pagination Variables
let currentPage = 1;
let rowsPerPage = 10;
let filteredLogsGlobal = []; 

// --- Master Lists ---
const FACULTY_LIST = ["คณะวิทยาศาสตร์", "คณะเกษตรศาสตร์", "คณะวิศวกรรมศาสตร์", "คณะศิลปศาสตร์", "คณะเภสัชศาสตร์", "คณะบริหารศาสตร์", "คณะพยาบาลศาสตร์", "วิทยาลัยแพทยศาสตร์และการสาธารณสุข", "คณะศิลปประยุกต์และสถาปัตยกรรมศาสตร์", "คณะนิติศาสตร์", "คณะรัฐศาสตร์", "คณะศึกษาศาสตร์"];
const ORG_LIST = ["สำนักคอมพิวเตอร์และเครือข่าย", "สำนักบริหารทรัพย์สินและสิทธิประโยชน์", "สำนักวิทยบริการ", "กองกลาง", "กองแผนงาน", "กองคลัง", "กองบริการการศึกษา", "กองการเจ้าหน้าที่", "สำนักงานส่งเสริมและบริหารงานวิจัย ฯ", "สำนักงานพัฒนานักศึกษา", "สำนักงานบริหารกายภาพและสิ่งแวดล้อม", "สำนักงานวิเทศสัมพันธ์", "สำนักงานนิติการ / สำนักงานกฎหมาย", "สำนักงานตรวจสอบภายใน", "สำนักงานรักษาความปลอดภัย", "สภาอาจารย์", "สหกรณ์ออมทรัพย์มหาวิทยาลัยอุบลราชธานี", "อุทยานวิทยาศาสตร์มหาวิทยาลัยอุบลราชธานี", "ศูนย์การจัดการความรู้ (KM)", "ศูนย์การเรียนรู้และพัฒนา \"งา\" เชิงเกษตรอุตสาหกรรมครัวเรือนแบบยั่งยืน", "สถานปฏิบัติการโรงแรมฯ (U-Place)", "ศูนย์วิจัยสังคมอนุภาคลุ่มน้ำโขง ฯ", "ศูนย์เครื่องมือวิทยาศาสตร์", "โรงพิมพ์มหาวิทยาลัยอุบลราชธานี"];

// --- ตัวแปรสำหรับเก็บ Instance ของกราฟใหม่ ---
let distributionBarInstance = null;
let dailyTrendLineInstance = null;

// ✅ ฟังก์ชันวาดกราฟแท่ง 2.1 (แกน Y อยู่ที่เดิม + แท่งรวมกลุ่มตรงกลาง)
function drawDistributionBarChart(data) {
    const ctx = document.getElementById('distributionBarChart');
    if (!ctx) return;
    if (distributionBarInstance) distributionBarInstance.destroy();

    const sortedData = Object.entries(data).sort((a, b) => b[1] - a[1]);
    
    distributionBarInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedData.map(x => x[0]),
            datasets: [{
                label: 'จำนวนครั้ง',
                data: sortedData.map(x => Math.floor(x[1])),
                backgroundColor: '#1d73f2',
                borderRadius: 4,
                
                // 🛠️ ส่วนสำคัญที่ทำให้แท่งรวมกลุ่มตรงกลาง:
                // 1. categoryPercentage: บีบพื้นที่รวมของกลุ่มแท่ง (ยิ่งน้อย ยิ่งกองอยู่ตรงกลาง)
                categoryPercentage: 0.3, 
                // 2. barPercentage: ความกว้างของแท่งภายในพื้นที่ที่บีบ (ปรับให้ผอมตามชอบ)
                barPercentage: 0.5,
                // ล็อกความหนาสูงสุดเพื่อความสวยงาม
                maxBarThickness: 35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    // แกน Y จะอยู่ชิดซ้ายสุดตามปกติ
                    ticks: { 
                        stepSize: 1, 
                        precision: 0,
                        font: { family: "'Prompt', sans-serif" }
                    },
                    grid: {
                        color: '#f0f0f0',
                        drawBorder: true // แสดงเส้นขอบแกน Y
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { 
                        font: { family: "'Prompt', sans-serif", size: 12 },
                        color: '#666'
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    bodyFont: { family: "'Prompt', sans-serif" }
                }
            }
        }
    });
}

function drawDailyTrendLineChart(dailyData, timeMode) {
    const ctx = document.getElementById('dailyTrendLineChart');
    if (!ctx) return;
    if (dailyTrendLineInstance) dailyTrendLineInstance.destroy();

    let labels = [];
    let dataPoints = [];

    if (timeMode === 'yearly') {
        labels = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        dataPoints = labels.map(month => dailyData[month] || 0);
    } 
    else if (timeMode === 'daily' || timeMode === 'monthly') {
        let startD, endD;

        if (timeMode === 'daily') {
            startD = new Date(document.getElementById('dateStart').value);
            endD = new Date(document.getElementById('dateEnd').value);
        } else {
            // โหมด Monthly: หาตั้งแต่วันที่ 1 ของเดือนเริ่ม จนถึงวันสุดท้ายของเดือนจบ
            const mStartVal = document.getElementById('monthStart').value;
            const mEndVal = document.getElementById('monthEnd').value;
            startD = new Date(mStartVal + "-01");
            const parts = mEndVal.split('-');
            endD = new Date(parts[0], parts[1], 0);
        }

        if (startD && endD && !isNaN(startD) && !isNaN(endD)) {
            let curr = new Date(startD);
            while (curr <= endD) {
                const dateStr = curr.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                labels.push(dateStr);
                dataPoints.push(dailyData[dateStr] || 0);
                curr.setDate(curr.getDate() + 1);
            }
        }
    } 
    else {
        labels = Object.keys(dailyData);
        dataPoints = labels.map(d => dailyData[d]);
    }

    dailyTrendLineInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'จำนวนครั้งการใช้งาน',
                data: dataPoints,
                borderColor: '#1d73f2',
                backgroundColor: 'rgba(29, 115, 242, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0,
                pointBackgroundColor: '#1d73f2',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { grid: { display: true, color: '#f0f0f0' }, ticks: { font: { family: "'Prompt', sans-serif", size: 10 } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // โหลดข้อมูลครั้งแรก
    allLogs = (DB.getLogs && typeof DB.getLogs === 'function') ? DB.getLogs() : [];
    lastLogCount = allLogs.length; 

    initFilters();      
    initDateInputs();   
    
    renderLifetimeStats(); 
    applyFilters(); // เรียกครั้งแรกเพื่อให้แสดงผลเลย

    setInterval(checkForUpdates, 5000); 
});

function checkForUpdates() {
    const currentLogs = (DB.getLogs && typeof DB.getLogs === 'function') ? DB.getLogs() : [];
    if (currentLogs.length !== lastLogCount) {
        allLogs = currentLogs;
        lastLogCount = currentLogs.length;
        applyFilters(); // อัปเดตเมื่อมีข้อมูลใหม่เข้ามา
        renderLifetimeStats();
    }
}

// ==========================================
// 1. INIT UI COMPONENTS
// ==========================================

function initFilters() {
    const facContainer = document.getElementById('studentFacultyList');
    if (facContainer) {
        facContainer.innerHTML = FACULTY_LIST.map((fac, index) => `
            <div class="form-check">
                <input class="form-check-input fac-check" type="checkbox" value="${fac}" id="fac_${index}" checked>
                <label class="form-check-label small" for="fac_${index}">${fac}</label>
            </div>
        `).join('');
    }

    const orgContainer = document.getElementById('staffOrgList');
    if (orgContainer) {
        orgContainer.innerHTML = ORG_LIST.map((org, index) => `
            <div class="form-check">
                <input class="form-check-input org-check" type="checkbox" value="${org}" id="org_${index}" checked>
                <label class="form-check-label small" for="org_${index}">${org}</label>
            </div>
        `).join('');
    }

    const yearStart = document.getElementById('yearStart');
    const yearEnd = document.getElementById('yearEnd');
    if (yearStart && yearEnd) {
        const currentYear = new Date().getFullYear() + 543;
        for (let y = currentYear; y >= currentYear - 5; y--) {
            yearStart.innerHTML += `<option value="${y - 543}">${y}</option>`;
            yearEnd.innerHTML += `<option value="${y - 543}">${y}</option>`;
        }
        yearStart.value = currentYear - 543;
        yearEnd.value = currentYear - 543;
    }
}

function initDateInputs() {
    const today = new Date();
    const dStart = document.getElementById('dateStart');
    const dEnd = document.getElementById('dateEnd');
    if (dEnd) dEnd.valueAsDate = today;
    if (dStart) {
        const lastMonth = new Date();
        lastMonth.setDate(lastMonth.getDate() - 30);
        dStart.valueAsDate = lastMonth;
    }
    const mStr = today.toISOString().slice(0, 7);
    const mStart = document.getElementById('monthStart');
    const mEnd = document.getElementById('monthEnd');
    if (mStart) mStart.value = mStr;
    if (mEnd) mEnd.value = mStr;
}

// ==========================================
// 2. UI INTERACTION
// ==========================================

function toggleFilterMode() {
    const modeEl = document.querySelector('input[name="userTypeOption"]:checked');
    if (!modeEl) return;
    const mode = modeEl.value;
    
    ['student', 'staff', 'external', 'all'].forEach(m => {
        const el = document.getElementById(`filter-${m}-section`);
        if(el) el.classList.add('d-none');
    });

    const targetEl = document.getElementById(`filter-${mode}-section`);
    if(targetEl) targetEl.classList.remove('d-none');
}

function toggleTimeInputs() {
    const typeEl = document.getElementById('timeFilterType');
    if (!typeEl) return;
    const type = typeEl.value;
    
    ['daily', 'monthly', 'yearly'].forEach(t => {
        document.getElementById(`input-${t}`).classList.add('d-none');
    });
    document.getElementById(`input-${type}`).classList.remove('d-none');
}

function toggleCheckAll(containerId) {
    const checkboxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]`);
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
}

function getCheckedValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}

// ==========================================
// 3. CORE LOGIC (FILTER)
// ==========================================

function generateReport() {
    // ✅ บังคับรีเซ็ตหน้าเป็น 1 เมื่อกดปุ่มประมวลผล เพื่อให้ตารางเด้งไปหน้าแรกสุดของข้อมูลชุดใหม่
    currentPage = 1;
    applyFilters(); 
}

/* admin-report.js - แก้ไขลอจิก applyFilters ตามความต้องการของผู้ใช้ */

// admin-report.js

function applyFilters() { 
    // 1. ดึงข้อมูล Log ทั้งหมดที่สิ้นสุดการใช้งานแล้ว
    const allStatsLogs = allLogs.filter(l => l.action === 'END_SESSION');

    // 2. ดึงค่าตัวคัดกรองจากหน้าจอ
    const userModeEl = document.querySelector('input[name="userTypeOption"]:checked');
    const userMode = userModeEl ? userModeEl.value : 'all';
    const timeMode = document.getElementById('timeFilterType').value;
    const selectedFaculties = getCheckedValues('studentFacultyList');
    const selectedOrgs = getCheckedValues('staffOrgList');

    // 3. กรองข้อมูลตามเงื่อนไข
    let filteredLogs = allStatsLogs.filter(log => {
        const logDate = new Date(log.startTime || log.timestamp);
        const logFaculty = (log.userFaculty || "").trim();

        // กรองตามเวลา (Daily / Monthly)
        if (timeMode === 'daily') {
            const start = new Date(document.getElementById('dateStart').value);
            const end = new Date(document.getElementById('dateEnd').value);
            if (!isNaN(start) && !isNaN(end)) {
                start.setHours(0,0,0,0); end.setHours(23,59,59,999);
                if (logDate < start || logDate > end) return false;
            }
        } else if (timeMode === 'monthly') {
            const mStart = new Date(document.getElementById('monthStart').value + "-01");
            const mEndInput = document.getElementById('monthEnd').value;
            const mEndParts = mEndInput.split('-');
            const mEnd = new Date(mEndParts[0], mEndParts[1], 0, 23, 59, 59);
            if (logDate < mStart || logDate > mEnd) return false;
        }

        const role = (log.userRole || '').toLowerCase();
        
        // ✅ [LOGIC แก้ไข] การกรองข้อมูลนักศึกษา
        if (userMode === 'student') {
            if (role !== 'student') return false;
            
            // ตรวจสอบคณะ
            const isFacultyMatch = selectedFaculties.some(fac => fac.trim() === logFaculty);
            if (!isFacultyMatch) return false;

            // ตรวจสอบ ระดับการศึกษา / ชั้นปี
            const combinedValue = document.getElementById('combinedYearLevel').value;
            const userLevel = (log.userLevel || "").toString().trim();
            const userYear = (log.userYear || "").toString().trim(); // ค่าจาก DB เช่น "5"

            if (combinedValue !== 'all') {
                if (combinedValue === 'undergrad_all') {
                    // กรณีเลือก ปริญญาตรี (ทั้งหมด) -> เอาทุกชั้นปีที่เป็น ป.ตรี
                    if (userLevel !== 'ปริญญาตรี') return false;
                } 
                else if (combinedValue === 'ปริญญาโท' || combinedValue === 'ปริญญาเอก') {
                    if (userLevel !== combinedValue) return false;
                } 
                else if (combinedValue === '5+') {
                    // ✅ แก้ไขจุดนี้: ถ้าเลือก 5+ ให้เช็คว่าเป็น ป.ตรี และ ปีตั้งแต่ 5 ขึ้นไป
                    const yNum = parseInt(userYear);
                    if (userLevel !== 'ปริญญาตรี' || isNaN(yNum) || yNum < 5) return false;
                } 
                else {
                    // กรณีเลือกปี 1, 2, 3, 4
                    if (userLevel !== 'ปริญญาตรี' || userYear !== combinedValue) return false;
                }
            }
        } 
        else if (userMode === 'staff') {
            if (role !== 'staff' && role !== 'admin') return false;
            return selectedOrgs.some(org => org.trim() === logFaculty);
        } 
        else if (userMode === 'external') {
            if (role !== 'external') return false;
        }
        
        return true;
    });

    // 4. เตรียมข้อมูลกราฟ
    let distributionData = {};
    const timeChartData = {};

    filteredLogs.forEach(l => {
        // กราฟ 2.1: แยกกลุ่มผู้ใช้ (คง นักศึกษา/บุคลากร/ภายนอก ไว้)
        let distLabel = l.userFaculty || 'ไม่ระบุ';
        if (userMode === 'all') {
            if (l.userRole === 'student') distLabel = "นักศึกษา";
            else if (l.userRole === 'staff' || l.userRole === 'admin') distLabel = "บุคลากร";
            else distLabel = "บุคคลภายนอก";
        }
        distributionData[distLabel] = (distributionData[distLabel] || 0) + 1;

        // กราฟ 2.2: กำหนด Label แกน X (โหมด Monthly ใช้รายวันเหมือน Daily)
        const dateObj = new Date(l.startTime || l.timestamp);
        let timeLabel;
        if (timeMode === 'daily' || timeMode === 'monthly') {
            timeLabel = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        } else if (timeMode === 'yearly') {
            timeLabel = dateObj.toLocaleDateString('th-TH', { month: 'long' });
        }
        timeChartData[timeLabel] = (timeChartData[timeLabel] || 0) + 1;
    });

    // 5. อัปเดตส่วนต่าง ๆ
    updateSummaryCards(filteredLogs);
    drawDistributionBarChart(distributionData);
    drawDailyTrendLineChart(timeChartData, timeMode);

    const globalChartData = processLogsForCharts(filteredLogs, timeMode);
    if (topSoftwareChartInstance) topSoftwareChartInstance.destroy();
    topSoftwareChartInstance = drawTopSoftwareChart(globalChartData.softwareStats);
    
    if (pieChartInstance) pieChartInstance.destroy();
    pieChartInstance = drawAIUsagePieChart(globalChartData.aiUsageData);
    
    drawSatisfactionChart(globalChartData.satisfactionData);
    renderFeedbackComments(filteredLogs);
    renderLogHistory(filteredLogs);
}

function updateSummaryCards(data) {
    // นับจำนวนคนจริงๆ แบบไม่ซ้ำรหัส (จะออกมาเป็น 14 คนสำหรับนักศึกษา)
    const uniqueUsers = new Set(data.map(log => log.userId)).size;

    // นับจำนวนครั้งที่ทำรายการสำเร็จ (Sessions)
    const sessionCount = data.length;

    // คำนวณเวลารวม
    let totalMinutes = 0;
    data.forEach(log => { totalMinutes += (log.durationMinutes || 0); });
    const totalHours = (totalMinutes / 60).toFixed(1);

    // แสดงผล
    animateValue("resultUserCount", 0, uniqueUsers, 500); 
    animateValue("resultSessionCount", 0, sessionCount, 500);
    animateValue("resultTotalHours", 0, parseFloat(totalHours), 500);
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if(!obj) return;
    // Simple set text to avoid animation glitch if rapid updates
    obj.innerHTML = end.toLocaleString(); 
}

// ==========================================
// 4. CHART PROCESSING
// ==========================================

function processLogsForCharts(logs, mode) {
    const result = {
        monthlyFacultyData: {}, monthlyOrgData: {}, aiUsageData: { ai: 0, nonAI: 0 },
        pcAvgTimeData: [], satisfactionData: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, total: 0 },
        softwareStats: {}, quickStats: { topPC: { name: '-', value: 0 }, avgTime: { hours: 0, minutes: 0 } }
    };
    
    const pcUsageMap = new Map();
    const allPCs = (DB.getPCs && typeof DB.getPCs === 'function') ? DB.getPCs() : [];
    allPCs.forEach(pc => pcUsageMap.set(String(pc.id), { total: 0, count: 0 }));

    logs.forEach(log => {
        const dateObj = new Date(log.timestamp);
        let timeKey;
        if (mode === 'daily') timeKey = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }); 
        else if (mode === 'yearly') timeKey = (dateObj.getFullYear() + 543).toString();
        else timeKey = dateObj.toLocaleDateString('th-TH', { year: '2-digit', month: 'short' });

        const faculty = log.userFaculty || 'Unknown';
        let target = null;
        if (FACULTY_LIST.includes(faculty) || faculty.startsWith("คณะ") || faculty.startsWith("วิทยาลัย")) target = result.monthlyFacultyData;
        else if (ORG_LIST.includes(faculty)) target = result.monthlyOrgData;
        else {
             if(log.userRole === 'student') target = result.monthlyFacultyData;
             else target = result.monthlyOrgData;
        }

        if (target) {
            if (!target[timeKey]) target[timeKey] = {};
            target[timeKey][faculty] = (target[timeKey][faculty] || 0) + 1;
        }

        if (log.isAIUsed) result.aiUsageData.ai++; else result.aiUsageData.nonAI++;

        if (Array.isArray(log.usedSoftware)) {
            log.usedSoftware.forEach(sw => {
                const name = sw.split('(')[0].trim();
                result.softwareStats[name] = (result.softwareStats[name] || 0) + 1;
            });
        }

        const pcId = String(log.pcId);
        const duration = log.durationMinutes || 0;
        if (pcUsageMap.has(pcId)) {
            pcUsageMap.get(pcId).total += duration;
            pcUsageMap.get(pcId).count++;
        }

        if (log.satisfactionScore) {
            const score = parseInt(log.satisfactionScore);
            if (score >= 1 && score <= 5) {
                result.satisfactionData[score]++;
                result.satisfactionData.total++;
            }
        }
    });

    let maxPcId = null; let maxPcAvg = -1;
    result.pcAvgTimeData = Array.from(pcUsageMap.entries()).map(([id, d]) => {
        const avg = d.count > 0 ? (d.total / d.count) : 0;
        if (avg > maxPcAvg) { maxPcAvg = avg; maxPcId = id; }
        const pcInfo = allPCs.find(p => String(p.id) === id);
        return { pcId: pcInfo ? pcInfo.name : `PC-${id}`, avgTime: avg.toFixed(1) };
    });

    if (maxPcId) {
        const pcInfo = allPCs.find(p => String(p.id) === maxPcId);
        result.quickStats.topPC = { name: pcInfo ? pcInfo.name : `PC-${maxPcId}`, value: maxPcAvg.toFixed(1) };
        const elTopPC = document.getElementById('statTopPC');
        const elTopPCTime = document.getElementById('statTopPCTime');
        if(elTopPC) elTopPC.innerText = result.quickStats.topPC.name;
        if(elTopPCTime) elTopPCTime.innerText = `(เฉลี่ย ${result.quickStats.topPC.value} นาที)`;
    }
    
    const globalCount = logs.length;
    let globalTotal = 0; logs.forEach(l => globalTotal += (l.durationMinutes||0));
    if(globalCount > 0) {
        const avg = globalTotal/globalCount;
        const elAvg = document.getElementById('statAvgTime');
        if(elAvg) elAvg.innerText = avg >= 60 ? `${(avg/60).toFixed(1)} ชม.` : `${avg.toFixed(0)} นาที`;
    }

    return result;
}

// ==========================================
// 5. CHART DRAWING FUNCTIONS
// ==========================================

function drawBeautifulLineChart(data, canvasId, topN = 5, mode = 'monthly') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const keys = Object.keys(data).sort((a,b) => {
         if (mode === 'daily') return parseInt(a) - parseInt(b);
         return a.localeCompare(b);
    });
    
    // Handle empty data for charts
    if (keys.length === 0) {
        // Create an empty chart placeholder if needed, or just return
        return; 
    }

    const totals = {};
    keys.forEach(k => Object.keys(data[k]).forEach(subKey => totals[subKey] = (totals[subKey]||0) + data[k][subKey]));
    const topKeys = Object.keys(totals).sort((a,b) => totals[b] - totals[a]).slice(0, topN);

    const datasets = topKeys.map((k, i) => ({
        label: k, data: keys.map(m => data[m][k] || 0),
        borderColor: getChartColor(i), backgroundColor: getChartColor(i),
        borderWidth: 2.5, tension: 0.4, pointRadius: 3, fill: false
    }));
    
    return new Chart(ctx.getContext('2d'), {
        type: 'line', data: { labels: keys, datasets },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15, font: { family: "'Prompt', sans-serif" } } } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
        }
    });
}

function drawTopSoftwareChart(data) {
    const ctx = document.getElementById('topSoftwareChart');
    if(!ctx) return;
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const sorted = Object.entries(data).sort((a,b) => b[1] - a[1]).slice(0, 10);
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 400, 0);
    gradient.addColorStop(0, '#4e73df'); gradient.addColorStop(1, '#36b9cc');

    return new Chart(ctx, {
        type: 'bar',
        data: { labels: sorted.map(x=>x[0]), datasets: [{ label: 'จำนวนการใช้งาน', data: sorted.map(x=>x[1]), backgroundColor: gradient, borderRadius: 10, barPercentage: 0.6 }] },
        options: { 
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, 
            plugins: { legend: {display:false}, tooltip: { callbacks: { label: (c) => ` ${c.raw} ครั้ง` } } }, 
            scales: { x: { beginAtZero: true, grid: { display: false }, ticks: { font: { family: "'Prompt', sans-serif" } } }, y: { grid: {display:false}, ticks: { font: { family: "'Prompt', sans-serif", weight: '500' } } } } 
        }
    });
}

function drawPCAvgTimeChart(d) { 
    const ctx = document.getElementById('pcAvgTimeChart');
    if(!ctx) return;
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    let labels = (d && d.length > 0) ? d.map(x=>x.pcId) : ["ไม่มีข้อมูล"];
    let values = (d && d.length > 0) ? d.map(x=>x.avgTime) : [0];
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, '#0d6efd'); gradient.addColorStop(1, '#8e2de2');

    return new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'เวลาเฉลี่ย (นาที)', data: values, backgroundColor: gradient, borderRadius: 6 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
        }
    });
}

function drawAIUsagePieChart(d) { 
    return new Chart(document.getElementById('aiUsagePieChart'), { 
        type: 'doughnut', 
        data: { labels: ['AI Tools', 'General Use'], datasets: [{ data: [d.ai, d.nonAI], backgroundColor: ['#4e73df', '#e2e6ea'], borderWidth: 0 }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position:'bottom', labels: { usePointStyle: true, font: { family: "'Prompt', sans-serif" } } } }, cutout: '70%' } 
    }); 
}

function drawSatisfactionChart(data) {
    const total = data.total || 0;
    let avgScore = 0.0;
    if (total > 0) {
        const weightedSum = (data[5]*5) + (data[4]*4) + (data[3]*3) + (data[2]*2) + (data[1]*1);
        avgScore = (weightedSum / total); 
    }
    const avgDisplay = avgScore.toFixed(1);
    
    const scoreEl = document.getElementById('satisfactionAvgScore');
    const countEl = document.getElementById('satisfactionTotalCount');
    const starsEl = document.getElementById('satisfactionStars');
    
    if(scoreEl) {
        let scoreClass = 'text-dark';
        if (avgScore >= 4.5) scoreClass = 'text-success';
        else if (avgScore >= 3.5) scoreClass = 'text-primary';
        else if (avgScore >= 2.5) scoreClass = 'text-warning';
        else if (avgScore > 0) scoreClass = 'text-danger';

        scoreEl.className = `fw-bold mb-0 me-3 ${scoreClass}`;
        scoreEl.innerText = avgDisplay;

        if(starsEl) {
            let starsHtml = '';
            for(let i=1; i<=5; i++) {
                if (i <= Math.floor(avgScore)) starsHtml += '<i class="bi bi-star-fill text-warning"></i>';
                else if (i === Math.ceil(avgScore) && !Number.isInteger(avgScore)) starsHtml += '<i class="bi bi-star-half text-warning"></i>';
                else starsHtml += '<i class="bi bi-star-fill text-muted opacity-25"></i>';
            }
            starsEl.innerHTML = starsHtml;
        }
    }
    if(countEl) countEl.innerText = `จากผู้ใช้งานทั้งหมด ${total.toLocaleString()} คน`;

    const container = document.getElementById('satisfactionProgressBars');
    if(!container) return;
    container.innerHTML = '';
    const barConfigs = { 5: { color: '#2ecc71' }, 4: { color: '#3498db' }, 3: { color: '#f1c40f' }, 2: { color: '#e67e22' }, 1: { color: '#e74c3c' } };

    for(let i=5; i>=1; i--) {
        const count = data[i] || 0;
        const percent = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
        const config = barConfigs[i];
        container.innerHTML += `
            <div class="d-flex align-items-center mb-2" style="height: 24px;">
                <div class="d-flex align-items-center justify-content-end me-2" style="width: 35px;">
                    <span class="small fw-bold text-muted me-1">${i}</span><i class="bi bi-star-fill text-warning small"></i>
                </div>
                <div class="flex-grow-1 progress" style="height: 8px; background-color: #f1f3f5; border-radius: 10px; overflow: hidden;">
                    <div class="progress-bar" style="width: ${percent}%; background-color: ${config.color}; border-radius: 10px; transition: width 1s ease;"></div>
                </div>
                <div class="ms-2 d-flex justify-content-between" style="width: 60px;">
                    <span class="small fw-bold text-dark">${percent}%</span><span class="small text-muted" style="font-size: 0.75rem;">(${count})</span>
                </div>
            </div>`;
    }
}

function getChartColor(i) { return ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#6f42c1'][i%6]; }

// ==========================================
// 6. RENDER TABLES & HELPERS (PAGINATION FIXED)
// ==========================================

function renderLogHistory(logs) {
    // ✅ 1. อัปเดตตัวแปร Global เพื่อใช้ในการเปลี่ยนหน้า
    filteredLogsGlobal = logs || [];
    
    // ✅ 2. ตรวจสอบว่ามีข้อมูลหรือไม่
    const totalItems = filteredLogsGlobal.length;
    const tbody = document.getElementById('logHistoryTableBody');
    if (!tbody) return;

    if (totalItems === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted py-5"><i class="bi bi-inbox fs-1 d-block mb-2 opacity-25"></i>ไม่พบข้อมูลประวัติการใช้งาน</td></tr>`;
        updatePaginationControls(0, 0, 0);
        return;
    }

    // ✅ 3. คำนวณหน้า (Pagination Logic)
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    if (currentPage > totalPages) currentPage = 1;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
    
    // ✅ 4. ตัดข้อมูลเฉพาะหน้าปัจจุบันมาแสดง
    const currentLogs = filteredLogsGlobal
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(startIndex, endIndex);

    // ✅ 5. สร้าง HTML (Table Rows)
    tbody.innerHTML = currentLogs.map((log, i) => {
        const dateObj = new Date(log.timestamp);
        const dateStr = dateObj.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
        
        let timeRangeStr = "-";
        if (log.startTime) {
            const start = new Date(log.startTime);
            const startStr = start.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'});
            const endStr = dateObj.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'});
            timeRangeStr = `${startStr} - ${endStr}`;
        } else {
            timeRangeStr = dateObj.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'});
        }
        
        let roleBadge = '<span class="badge bg-secondary">Guest</span>';
        if (log.userRole === 'student') roleBadge = '<span class="badge bg-primary">Student</span>';
        else if (log.userRole === 'staff') roleBadge = '<span class="badge bg-success">Staff</span>';
        else if (log.userRole === 'external') roleBadge = '<span class="badge bg-dark">External</span>';

        let swTags = '-';
        if (log.usedSoftware && log.usedSoftware.length > 0) {
            swTags = log.usedSoftware.map(s => `<span class="badge bg-light text-dark border me-1 mb-1">${s}</span>`).join('');
        }

        const score = log.satisfactionScore 
            ? `<span style="color: #ffc107;" class="fw-bold"><i class="bi bi-star-fill"></i> ${log.satisfactionScore}</span>` 
            : '<span class="text-muted">-</span>';

        return `
            <tr>
                <td class="text-center text-muted small">${startIndex + i + 1}</td>
                <td class="fw-bold text-primary text-center">${log.userId || '-'}</td>
                <td>${log.userName || 'Unknown'}</td>
                <td><div class="d-flex flex-wrap">${swTags}</div></td>
                <td class="text-center">${dateStr}</td>
                <td class="text-center"><span class="badge bg-light text-dark border">${timeRangeStr}</span></td>
                <td>${log.userFaculty || '-'}</td>
                <td class="text-center"> ${log.userRole === 'student' ? 
                        `<span class="badge bg-info bg-opacity-10 text-info border border-info px-2" style="font-size: 0.75rem;">ปี ${log.userYear || 'N/A'}</span>` 
                        : '-'}
                </td>
                <td class="text-center">${roleBadge}</td>
                <td class="text-center"><span class="badge bg-dark bg-opacity-75">PC-${log.pcId}</span></td>
                <td class="text-center">${score}</td>
            </tr>
        `;
    }).join('');

    updatePaginationControls(totalItems, startIndex + 1, endIndex);
}

function updatePaginationControls(totalItems, startItem, endItem) {
    const infoEl = document.getElementById('paginationInfo');
    const navEl = document.getElementById('paginationControls');
    
    if (infoEl) infoEl.innerText = `แสดง ${startItem} - ${endItem} จากทั้งหมด ${totalItems} รายการ`;
    if (!navEl) return;
    
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    let html = '';

    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link cursor-pointer" onclick="goToPage(${currentPage - 1})"><i class="bi bi-chevron-left"></i></a>
             </li>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link cursor-pointer" onclick="goToPage(${i})">${i}</a>
                     </li>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
             html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }

    html += `<li class="page-item ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}">
                <a class="page-link cursor-pointer" onclick="goToPage(${currentPage + 1})"><i class="bi bi-chevron-right"></i></a>
             </li>`;

    navEl.innerHTML = html;
}

function goToPage(page) {
    if (page < 1) return;
    currentPage = page;
    renderLogHistory(filteredLogsGlobal); 
}

function changeRowsPerPage(rows) {
    rowsPerPage = parseInt(rows);
    currentPage = 1; 
    renderLogHistory(filteredLogsGlobal);
}

function renderFeedbackComments(logs) {
    const container = document.getElementById('feedbackCommentList');
    const countBadge = document.getElementById('commentCount');
    if (!container) return;

    const comments = logs.filter(log => log.comment && log.comment.trim() !== "");
    if(countBadge) countBadge.innerText = comments.length;

    if (comments.length === 0) {
        container.innerHTML = `<div class="d-flex flex-column align-items-center justify-content-center h-100 text-muted mt-5"><i class="bi bi-chat-square-heart fs-1 opacity-25 mb-2"></i><p class="small">ยังไม่มีข้อเสนอแนะในขณะนี้</p></div>`;
        return;
    }

    const sortedComments = comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    container.innerHTML = sortedComments.map(log => {
        const score = parseInt(log.satisfactionScore) || 0;
        let stars = '';
        for(let i=1; i<=5; i++) stars += i <= score ? '<i class="bi bi-star-fill text-warning"></i>' : '<i class="bi bi-star text-muted opacity-25"></i>';
        
        const dateObj = new Date(log.timestamp);
        const dateStr = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        const timeStr = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const user = log.userName || 'Unknown';
        const role = log.userRole === 'student' ? 'นักศึกษา' : (log.userRole === 'staff' ? 'บุคลากร' : 'Guest');
        let borderColor = '#dc3545'; let avatarColor = 'bg-danger';
        if (score >= 4) { borderColor = '#198754'; avatarColor = 'bg-success'; } 
        else if (score === 3) { borderColor = '#ffc107'; avatarColor = 'bg-warning text-dark'; }
        const initial = user.charAt(0).toUpperCase();

        return `
            <div class="card feedback-item border-0 shadow-sm mb-2" style="border-left: 5px solid ${borderColor} !important;">
                <div class="card-body p-3">
                    <div class="d-flex align-items-start">
                        <div class="avatar-circle ${avatarColor} bg-opacity-75 shadow-sm me-3 flex-shrink-0">${initial}</div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <div><span class="fw-bold text-dark" style="font-size: 0.95rem;">${user}</span><span class="badge bg-light text-secondary border ms-1 fw-normal" style="font-size: 0.7rem;">${role}</span></div>
                                <div class="small" style="font-size: 0.75rem;">${stars}</div>
                            </div>
                            <p class="mb-2 text-secondary" style="font-size: 0.9rem; line-height: 1.5;">"${log.comment}"</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <small class="text-muted" style="font-size: 0.75rem;"><i class="bi bi-pc-display me-1"></i>PC-${log.pcId}</small>
                                <small class="text-muted" style="font-size: 0.75rem;"><i class="bi bi-clock me-1"></i>${dateStr} ${timeStr}</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function exportReport(mode) {
    const modeNames = { 'daily': 'รายวัน (Daily)', 'monthly': 'รายเดือน (Monthly)', 'quarterly': 'รายไตรมาส (Quarterly)', 'yearly': 'รายปี (Yearly)' };
    const selectedModeName = modeNames[mode] || mode;

    if (!confirm(`ยืนยันการดาวน์โหลดรายงาน "${selectedModeName}" หรือไม่?`)) return;

    const today = new Date();
    let startDate, endDate, fileNamePrefix;
    switch(mode) {
        case 'daily': startDate = new Date(today); endDate = new Date(today); fileNamePrefix = `Daily_Report_${formatDateStr(today)}`; break;
        case 'monthly': startDate = new Date(today.getFullYear(), today.getMonth(), 1); endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); fileNamePrefix = `Monthly_Report_${today.getFullYear()}_${today.getMonth()+1}`; break;
        case 'quarterly': const q = Math.floor(today.getMonth() / 3); startDate = new Date(today.getFullYear(), q * 3, 1); endDate = new Date(today.getFullYear(), (q * 3) + 3, 0); fileNamePrefix = `Quarterly_Report_${today.getFullYear()}_Q${q+1}`; break;
        case 'yearly': startDate = new Date(today.getFullYear(), 0, 1); endDate = new Date(today.getFullYear(), 11, 31); fileNamePrefix = `Yearly_Report_${today.getFullYear()}`; break;
        default: return;
    }
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);
    generateCSV(startDate, endDate, fileNamePrefix);
}

function exportCSV() {
    const filteredLogs = filterLogs(allLogs, getFilterParams());
    if (filteredLogs.length === 0) { alert("ไม่พบข้อมูล Log ตามเงื่อนไขที่เลือก"); return; }
    const fileName = `Usage_Report_${new Date().toLocaleDateString('en-CA')}`;
    createCSVFile(filteredLogs, fileName);
}

function generateCSV(startDateObj, endDateObj, fileNamePrefix) {
    const filteredLogs = allLogs.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= startDateObj.getTime() && logTime <= endDateObj.getTime();
    });
    if (filteredLogs.length === 0) { alert('ไม่พบข้อมูลในช่วงเวลาดังกล่าว'); return; }
    createCSVFile(filteredLogs, fileNamePrefix);
}

function createCSVFile(logs, fileName) {
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); 
    // ✅ Fix: CSV Header matches HTML table
    const headers = ["ลำดับ", "รหัสผู้ใช้งาน", "ชื่อ-สกุล", "AI/Software ที่ใช้", "วันที่ใช้บริการ", "ช่วงเวลาใช้บริการ", "รหัสคณะ/สำนัก", "สถานะ", "PC ที่ใช้", "ระยะเวลา (นาที)", "ความพึงพอใจ (Score)"];
    const csvRows = logs.map((log, index) => {
        const userId = log.userId || '-';
        const userName = log.userName || '-';
        const software = (log.usedSoftware && log.usedSoftware.length) ? log.usedSoftware.join('; ') : '-';
        const end = new Date(log.timestamp);
        const start = log.startTime ? new Date(log.startTime) : end;
        const dateStr = end.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeRange = `${start.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}`;
        const faculty = log.userFaculty || (log.userRole === 'external' ? 'บุคคลภายนอก' : '-');
        let role = 'บุคคลภายนอก';
        if (log.userRole === 'student') role = 'นักศึกษา';
        else if (log.userRole === 'staff') role = 'บุคลากร/อาจารย์';
        const pcName = `PC-${log.pcId || '?'}`;
        const duration = log.durationMinutes ? log.durationMinutes.toFixed(0) : '0';
        const satisfaction = log.satisfactionScore || '-';
        return [`"${index + 1}"`, `"${userId}"`, `"${userName}"`, `"${software}"`, `"${dateStr}"`, `"${timeRange}"`, `"${faculty}"`, `"${role}"`, `"${pcName}"`, `"${duration}"`, `"${satisfaction}"`].join(',');
    });
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderLifetimeStats() {
    const logs = DB.getLogs();
    const total = logs.length;
    const internal = logs.filter(l => l.userRole === 'student' || l.userRole === 'staff').length;
    const external = total - internal; 

    document.getElementById('lifetimeTotalCount').innerText = total.toLocaleString();
    if(document.getElementById('lifetimeInternal')) document.getElementById('lifetimeInternal').innerText = internal.toLocaleString();
    if(document.getElementById('lifetimeExternal')) document.getElementById('lifetimeExternal').innerText = external.toLocaleString();
    if (total > 0) {
        if(document.getElementById('progInternal')) document.getElementById('progInternal').style.width = `${(internal / total) * 100}%`;
        if(document.getElementById('progExternal')) document.getElementById('progExternal').style.width = `${(external / total) * 100}%`;
    }
}

function autoSetDates() { 
    const periodSelect = document.getElementById('filterPeriod');
    if (!periodSelect) return; 
    const p = periodSelect.value;
    const t = new Date(); 
    let s, e; 
    if (p === 'daily_31') { s = new Date(t.getFullYear(), t.getMonth(), 1); e = new Date(t.getFullYear(), t.getMonth() + 1, 0); } 
    else if (p === 'monthly_12') { s = new Date(t.getFullYear(), 0, 1); e = new Date(t.getFullYear(), 11, 31); } 
    else if (p === 'quarterly') { const q = Math.floor(t.getMonth() / 3); s = new Date(t.getFullYear(), q * 3, 1); e = new Date(t.getFullYear(), (q * 3) + 3, 0); } 
    else if (p === 'yearly_custom') { s = new Date(2025, 0, 1); e = t; } 
    else if (p === 'custom') return; 

    if (s && e) {
        document.getElementById('filterStartDate').value = formatDateForInput(s); 
        document.getElementById('filterEndDate').value = formatDateForInput(e);
        applyFilters(); 
    } 
}

function processImportCSV(el) { alert('ฟังก์ชัน Import CSV ทำงานปกติ (จำลอง)'); }
function formatDateForInput(date) { return date.toLocaleDateString('en-CA'); } 
function formatDateStr(date) { return date.toLocaleDateString('en-CA'); } 
function getSatisfactionDisplay(score) { if (!score) return '-'; const c = score>=4?'success':(score>=2?'warning text-dark':'danger'); return `<span class="badge bg-${c}"><i class="bi bi-star-fill"></i> ${score}</span>`; }

// ==========================================
// 7. IMPORT / EXPORT SYSTEM
// ==========================================

function exportAllLogs() {
    if (!allLogs || allLogs.length === 0) {
        alert("ไม่มีข้อมูล Log ในระบบ");
        return;
    }
    if (!confirm(`ยืนยันการ Export ข้อมูล Log ทั้งหมด (${allLogs.length} รายการ)?`)) return;
    const now = new Date();
    const fileName = `CKLab_Logs_Backup_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours()}${now.getMinutes()}`;
    createCSVFile(allLogs, fileName);
}

function handleLogImport(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { processLogCSV(e.target.result); };
    reader.readAsText(file);
    input.value = '';
}

// ✅ FIX: Import parsing to handle "Start - End" time correctly
function processLogCSV(csvText) {
    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
    const dataLines = lines.slice(1);
    
    if (dataLines.length === 0) {
        alert("❌ ไม่พบข้อมูลในไฟล์ CSV");
        return;
    }

    let successCount = 0;
    let failCount = 0;
    let importedLogs = [];
    const existingLogs = (DB.getLogs && typeof DB.getLogs === 'function') ? DB.getLogs() : [];

    dataLines.forEach((line, index) => {
        const cleanLine = line.replace(/"/g, '');
        const cols = cleanLine.split(',');

        if (cols.length < 5) { failCount++; return; }

        try {
            const userId = cols[1];
            const name = cols[2];
            const softwareStr = cols[3];
            const dateStr = cols[4]; 
            const timeRange = cols[5]; // "09:00 - 10:30"
            const faculty = cols[6];
            let roleRaw = cols[7];
            const pcName = cols[8];
            const duration = parseFloat(cols[9]) || 0;
            const score = cols[10] === '-' ? null : parseInt(cols[10]);

            let role = 'guest';
            if (roleRaw.includes('นักศึกษา')) role = 'student';
            else if (roleRaw.includes('บุคลากร')) role = 'staff';
            else if (roleRaw.includes('ภายนอก')) role = 'external';

            // ✅ Date Parsing
            const [dd, mm, yyyy] = dateStr.split('/');
            const yearAD = parseInt(yyyy) - 543;
            
            // ✅ Time Parsing (FULL UNPACK)
            const timeParts = timeRange.split('-');
            const startTimeStr = timeParts[0].trim(); 
            const endTimeStr = timeParts.length > 1 ? timeParts[1].trim() : startTimeStr; 

            const [startHr, startMin] = startTimeStr.split(':');
            const [endHr, endMin] = endTimeStr.split(':');

            const timestampStart = new Date(yearAD, parseInt(mm)-1, parseInt(dd), parseInt(startHr), parseInt(startMin));
            const timestampEnd = new Date(yearAD, parseInt(mm)-1, parseInt(dd), parseInt(endHr), parseInt(endMin));
            
            const usedSoftware = (softwareStr && softwareStr !== '-') ? softwareStr.split(';').map(s => s.trim()) : [];
            const isAI = usedSoftware.some(s => s.toLowerCase().includes('gpt') || s.toLowerCase().includes('claude') || s.toLowerCase().includes('ai'));

            const newLog = {
                timestamp: timestampEnd.toISOString(),
                startTime: timestampStart.toISOString(),
                action: 'END_SESSION', 
                userId: userId,
                userName: name,
                userRole: role,
                userFaculty: faculty,
                pcId: pcName.replace('PC-', ''),
                durationMinutes: duration,
                usedSoftware: usedSoftware,
                isAIUsed: isAI,
                satisfactionScore: score,
                imported: true 
            };

            importedLogs.push(newLog);
            successCount++;

        } catch (err) {
            console.error("Parse Error row " + (index+2), err);
            failCount++;
        }
    });

    if (successCount > 0) {
        const combinedLogs = [...existingLogs, ...importedLogs];
        if (DB.setData) { DB.setData('ck_logs', combinedLogs); }
        allLogs = combinedLogs;
        lastLogCount = allLogs.length;
        applyFilters();
        renderLifetimeStats();
        alert(`✅ Import สำเร็จ: ${successCount} รายการ\n❌ ล้มเหลว: ${failCount} รายการ`);
    } else {
        alert("❌ ไม่สามารถนำเข้าข้อมูลได้ (รูปแบบไฟล์ไม่ถูกต้อง)");
    }
}