const yearInput = document.getElementById("yearInput");
const wageInput = document.getElementById("wageInput");
const generateBtn = document.getElementById("generateBtn");

const paydaySelect = document.getElementById("paydaySelect");
const periodText = document.getElementById("periodText");
const shiftList = document.getElementById("shiftList");

const totalHoursText = document.getElementById("totalHours");
const totalPayText = document.getElementById("totalPay");
const yearHoursText = document.getElementById("yearHours");
const yearPayText = document.getElementById("yearPay");

const payOverview = document.getElementById("payOverview");
const themeBtn = document.getElementById("themeBtn");
const toggleOverviewBtn = document.getElementById("toggleOverviewBtn");

const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const clearBtn = document.getElementById("clearBtn");
const backupStatus = document.getElementById("backupStatus");
const saveStatus = document.getElementById("saveStatus");

let payPeriods = [];
let showAllOverview = false;
let saveTimer = null;

loadSettings();
generatePayPeriods();
renderPaydayOptions();
selectNearestPayday();
renderPeriod();
updateYearSummary();
renderPayOverview();

generateBtn.addEventListener("click", () => {
  const currentPayday = getCurrentSelectedPayday();

  saveSettings();
  generatePayPeriods();
  renderPaydayOptions(currentPayday);
  renderPeriod();
  updateYearSummary();
  renderPayOverview();
});

paydaySelect.addEventListener("change", () => {
  renderPeriod();
  renderPayOverview();
});

shiftList.addEventListener("input", (e) => {
  if (e.target.classList.contains("hours-input")) {
    saveShift(e.target.dataset.date, e.target.value);
    calculateCurrentPeriod();
    updateYearSummary();
    renderPayOverview();
    showSavedMessage();
  }
});

wageInput.addEventListener("input", () => {
  saveSettings();
  calculateCurrentPeriod();
  updateYearSummary();
  renderPayOverview();
});

yearInput.addEventListener("input", () => {
  saveSettings();
});

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("salary_theme", isDark ? "dark" : "light");

  themeBtn.textContent = isDark ? "切換亮色" : "切換深色";
});

toggleOverviewBtn.addEventListener("click", () => {
  showAllOverview = !showAllOverview;
  toggleOverviewBtn.textContent = showAllOverview ? "只顯示最近 6 次" : "顯示全部";
  renderPayOverview();
});

exportBtn.addEventListener("click", exportData);
importFile.addEventListener("change", importData);
clearBtn.addEventListener("click", clearAllShifts);

function saveSettings() {
  localStorage.setItem("salary_year", yearInput.value);
  localStorage.setItem("salary_wage", wageInput.value);
}

function loadSettings() {
  const savedYear = localStorage.getItem("salary_year");
  const savedWage = localStorage.getItem("salary_wage");
  const savedTheme = localStorage.getItem("salary_theme");

  if (savedYear) yearInput.value = savedYear;
  if (savedWage) wageInput.value = savedWage;

  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeBtn.textContent = "切換亮色";
  }
}

function generatePayPeriods() {
  payPeriods = [];

  const year = Number(yearInput.value);
  if (!year) return;

  for (let month = 1; month <= 12; month++) {
    const previousMonthDate = new Date(year, month - 2, 1);
    const previousYear = previousMonthDate.getFullYear();
    const previousMonth = previousMonthDate.getMonth();

    const firstStart = new Date(previousYear, previousMonth, 1);
    const firstEnd = new Date(previousYear, previousMonth, 15);

    const secondStart = new Date(previousYear, previousMonth, 16);
    const secondEnd = new Date(previousYear, previousMonth + 1, 0);

    const secondSaturday = getNthWeekdayOfMonth(year, month - 1, 6, 2);
    const fourthSaturday = getNthWeekdayOfMonth(year, month - 1, 6, 4);

    payPeriods.push({
      payday: formatInputDate(secondSaturday),
      start: formatInputDate(firstStart),
      end: formatInputDate(firstEnd),
      label: "上半月"
    });

    payPeriods.push({
      payday: formatInputDate(fourthSaturday),
      start: formatInputDate(secondStart),
      end: formatInputDate(secondEnd),
      label: "下半月"
    });
  }
}

function renderPaydayOptions(keepPayday = null) {
  paydaySelect.innerHTML = "";

  payPeriods.forEach((period, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${formatDisplayDate(period.payday)} 領薪｜${formatDisplayDate(period.start)}～${formatDisplayDate(period.end)}｜${period.label}`;
    paydaySelect.appendChild(option);
  });

  if (keepPayday) {
    const foundIndex = payPeriods.findIndex(p => p.payday === keepPayday);

    if (foundIndex !== -1) {
      paydaySelect.value = foundIndex;
      return;
    }
  }
}

function getCurrentSelectedPayday() {
  const period = payPeriods[paydaySelect.value];
  return period ? period.payday : null;
}

function selectNearestPayday() {
  if (payPeriods.length === 0) return;

  const today = new Date();
  let nearestIndex = payPeriods.length - 1;

  for (let i = 0; i < payPeriods.length; i++) {
    const payday = parseLocalDate(payPeriods[i].payday);

    if (payday >= today) {
      nearestIndex = i;
      break;
    }
  }

  paydaySelect.value = nearestIndex;
}

function renderPeriod() {
  const period = payPeriods[paydaySelect.value];

  if (!period) {
    periodText.textContent = "沒有發薪資料";
    shiftList.innerHTML = "";
    calculateCurrentPeriod();
    return;
  }

  periodText.textContent = `本次計薪區間：${formatDisplayDate(period.start)} ～ ${formatDisplayDate(period.end)}（${period.label}）`;

  shiftList.innerHTML = "";

  const startDate = parseLocalDate(period.start);
  const endDate = parseLocalDate(period.end);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateKey = formatInputDate(d);
    const savedHours = getShift(dateKey);

    const row = document.createElement("div");
    row.className = "shift-row";

    row.innerHTML = `
      <div>${formatDisplayDate(dateKey)}（${getWeekDay(d)}）</div>
      <input
        type="number"
        min="0"
        step="0.5"
        placeholder="時數"
        class="hours-input"
        data-date="${dateKey}"
        value="${savedHours}"
      >
    `;

    shiftList.appendChild(row);
  }

  calculateCurrentPeriod();
}

function calculateCurrentPeriod() {
  const inputs = document.querySelectorAll(".hours-input");
  let totalHours = 0;

  inputs.forEach(input => {
    const value = parseFloat(input.value);
    if (!isNaN(value)) totalHours += value;
  });

  const wage = Number(wageInput.value) || 0;
  const totalPay = Math.round(totalHours * wage);

  totalHoursText.textContent = formatHours(totalHours);
  totalPayText.textContent = totalPay.toLocaleString();
}

function renderPayOverview() {
  if (!payOverview) return;

  payOverview.innerHTML = "";

  const wage = Number(wageInput.value) || 0;
  const indexesToShow = getOverviewIndexes();

  indexesToShow.forEach(index => {
    const period = payPeriods[index];
    const totalHours = calculatePeriodHours(period.start, period.end);
    const totalPay = Math.round(totalHours * wage);

    const item = document.createElement("div");
    item.className = "overview-item";

    if (index == paydaySelect.value) {
      item.classList.add("active");
    }

    const statusText =
      totalHours > 0
        ? `${formatHours(totalHours)} 小時｜${totalPay.toLocaleString()} 元`
        : "尚未填寫";

    item.innerHTML = `
      <div class="overview-main">
        <strong>${formatDisplayDate(period.payday)} 領薪｜${period.label}</strong>
        <span>${formatDisplayDate(period.start)} ～ ${formatDisplayDate(period.end)}</span>
      </div>
      <div class="overview-money">${statusText}</div>
    `;

    item.addEventListener("click", () => {
      paydaySelect.value = index;
      renderPeriod();
      renderPayOverview();

      window.scrollTo({
        top: paydaySelect.offsetTop - 20,
        behavior: "smooth"
      });
    });

    payOverview.appendChild(item);
  });
}

function getOverviewIndexes() {
  if (showAllOverview) {
    return payPeriods.map((_, index) => index);
  }

  const currentIndex = Number(paydaySelect.value) || 0;
  const start = Math.max(0, currentIndex - 2);
  const end = Math.min(payPeriods.length - 1, currentIndex + 3);

  const indexes = [];
  for (let i = start; i <= end; i++) indexes.push(i);

  return indexes;
}

function calculatePeriodHours(start, end) {
  const allShifts = JSON.parse(localStorage.getItem("salary_shifts") || "{}");

  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);

  let totalHours = 0;

  Object.keys(allShifts).forEach(dateKey => {
    const d = parseLocalDate(dateKey);

    if (d >= startDate && d <= endDate) {
      const hours = parseFloat(allShifts[dateKey]);
      if (!isNaN(hours)) totalHours += hours;
    }
  });

  return totalHours;
}

function updateYearSummary() {
  const year = Number(yearInput.value);
  const wage = Number(wageInput.value) || 0;
  let totalHours = 0;

  const allShifts = JSON.parse(localStorage.getItem("salary_shifts") || "{}");

  Object.keys(allShifts).forEach(dateKey => {
    const d = parseLocalDate(dateKey);

    if (d.getFullYear() === year) {
      const hours = parseFloat(allShifts[dateKey]);
      if (!isNaN(hours)) totalHours += hours;
    }
  });

  const totalPay = Math.round(totalHours * wage);

  yearHoursText.textContent = formatHours(totalHours);
  yearPayText.textContent = totalPay.toLocaleString();
}

function exportData() {
  const data = {
    version: 2,
    rule: "1-15 and 16-end; paid next month on 2nd and 4th Saturday",
    exportedAt: new Date().toISOString(),
    settings: {
      year: yearInput.value,
      wage: wageInput.value,
      theme: localStorage.getItem("salary_theme") || "light"
    },
    shifts: JSON.parse(localStorage.getItem("salary_shifts") || "{}")
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  const fileName = `salary-backup-${yearInput.value}-${getTodayString()}.json`;

  a.href = url;
  a.download = fileName;
  a.click();

  URL.revokeObjectURL(url);

  backupStatus.textContent = `已匯出：${fileName}`;
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);

      if (!data || !data.shifts) {
        backupStatus.textContent = "匯入失敗：檔案格式不對。";
        return;
      }

      const confirmed = confirm("匯入後會覆蓋目前的工時紀錄，要繼續嗎？");

      if (!confirmed) {
        backupStatus.textContent = "已取消匯入。";
        return;
      }

      if (data.settings) {
        if (data.settings.year) yearInput.value = data.settings.year;
        if (data.settings.wage) wageInput.value = data.settings.wage;
      }

      localStorage.setItem("salary_shifts", JSON.stringify(data.shifts));

      saveSettings();
      generatePayPeriods();
      renderPaydayOptions();
      selectNearestPayday();
      renderPeriod();
      updateYearSummary();
      renderPayOverview();

      backupStatus.textContent = "匯入成功，資料已更新。";
    } catch (error) {
      backupStatus.textContent = "匯入失敗：JSON 檔案讀取錯誤。";
    }

    importFile.value = "";
  };

  reader.readAsText(file);
}

function clearAllShifts() {
  const confirmed = confirm("確定要清空全部工時紀錄嗎？這個動作不能復原。建議先匯出備份。");
  if (!confirmed) return;

  localStorage.removeItem("salary_shifts");
  renderPeriod();
  updateYearSummary();
  renderPayOverview();
  backupStatus.textContent = "已清空全部工時紀錄。";
}

function saveShift(dateKey, hours) {
  const allShifts = JSON.parse(localStorage.getItem("salary_shifts") || "{}");

  if (hours === "") {
    delete allShifts[dateKey];
  } else {
    allShifts[dateKey] = hours;
  }

  localStorage.setItem("salary_shifts", JSON.stringify(allShifts));
}

function getShift(dateKey) {
  const allShifts = JSON.parse(localStorage.getItem("salary_shifts") || "{}");
  return allShifts[dateKey] || "";
}

function showSavedMessage() {
  if (!saveStatus) return;

  saveStatus.textContent = "已儲存";

  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveStatus.textContent = "";
  }, 1200);
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateString) {
  const d = parseLocalDate(dateString);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function getWeekDay(date) {
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  return days[date.getDay()];
}

function formatHours(hours) {
  return Number.isInteger(hours) ? String(hours) : String(hours.toFixed(1));
}

function getTodayString() {
  const today = new Date();
  return formatInputDate(today);
}

function getNthWeekdayOfMonth(year, monthIndex, weekday, nth) {
  const date = new Date(year, monthIndex, 1);
  let count = 0;

  while (date.getMonth() === monthIndex) {
    if (date.getDay() === weekday) {
      count++;
      if (count === nth) {
        return new Date(date);
      }
    }

    date.setDate(date.getDate() + 1);
  }

  return null;
}
