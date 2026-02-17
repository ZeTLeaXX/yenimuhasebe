
// DOM Elements
const transactionList = document.getElementById('transaction-list');
const totalIncomeElement = document.getElementById('total-income');
const totalExpenseElement = document.getElementById('total-expense');
const netBalanceElement = document.getElementById('net-balance');

// Filters
const searchInput = document.getElementById('search-input');
const filterType = document.getElementById('filter-type');

// Chart
let myChart = null;
let allTransactions = [];
let companyId = null;

// Parse URL for companyId
const urlParams = new URLSearchParams(window.location.search);
companyId = urlParams.get('id');

if (!companyId) {
    // Show Error
    document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;color:white;text-align:center;"><h2>Link Geçersiz</h2><p>Şirket ID bulunamadı.</p></div>';
} else {
    document.getElementById('company-name-display').innerText = `Hesap ID: ${companyId}`;
    initTransactions();
}

function initTransactions() {
    if (!companyId) return;

    db.collection('transactions')
        .where('companyId', '==', companyId)
        .onSnapshot(snapshot => {
            allTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort Newest First
            allTransactions.sort((a, b) => {
                const dateA = a.date ? a.date.toDate() : new Date(0);
                const dateB = b.date ? b.date.toDate() : new Date(0);
                return dateB - dateA;
            });

            applyFilters();
        }, error => {
            console.error("Error loading transactions:", error);
            if (error.code === 'permission-denied') {
                alert("Erişim Reddedildi. Bu veriyi görme yetkiniz yok.");
            }
        });
}

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const typeFilter = filterType.value;

    const filtered = allTransactions.filter(item => {
        const matchesSearch = item.description.toLowerCase().includes(searchTerm) ||
            (item.addedBy && item.addedBy.toLowerCase().includes(searchTerm)) ||
            (item.category && item.category.toLowerCase().includes(searchTerm));

        const matchesType = typeFilter === 'all' ? true : item.type === typeFilter;
        return matchesSearch && matchesType;
    });

    updateDOM(filtered);
    updateValues(allTransactions);
    renderChart(allTransactions);
    calculateAdvancedStats(allTransactions);
}

searchInput.addEventListener('input', applyFilters);
filterType.addEventListener('change', applyFilters);

function updateDOM(transactions) {
    transactionList.innerHTML = '';

    if (transactions.length === 0) {
        transactionList.innerHTML = '<li class="empty-state">İşlem bulunamadı.</li>';
        return;
    }

    transactions.forEach(transaction => {
        const isIncome = transaction.type === 'income';
        const sign = isIncome ? '+' : '-';
        const itemClass = isIncome ? 'income' : 'expense';
        const categoryLabel = transaction.category ? `<span style="font-size:0.8em; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; margin-left:5px;">${transaction.category}</span>` : '';

        // Attachment Icon
        const attachmentIcon = transaction.receiptUrl ?
            `<a href="#" onclick="openReceipt('${transaction.id}')" title="Fişi Görüntüle" style="color:var(--accent-color); margin-left:5px;"><i class="fas fa-paperclip"></i></a>` : '';

        const dateStr = transaction.date && transaction.date.toDate ? transaction.date.toDate().toLocaleDateString('tr-TR') : 'Tarih Yok';

        const item = document.createElement('li');
        item.classList.add('transaction-item', itemClass);

        // NO DELETE BUTTON HERE
        item.innerHTML = `
            <div class="info">
                <h4>${transaction.description} ${categoryLabel} ${attachmentIcon}</h4>
                <span class="date">${dateStr} • ${transaction.addedBy || 'Anonim'}</span>
            </div>
            <div class="amount-action">
                <span class="amount">${sign}₺${formatMoney(transaction.amount)}</span>
            </div>
        `;

        transactionList.appendChild(item);
    });
}

function updateValues(transactions) {
    const income = transactions
        .filter(item => item.type === 'income')
        .reduce((acc, item) => (acc += item.amount), 0);

    const expense = transactions
        .filter(item => item.type === 'expense')
        .reduce((acc, item) => (acc += item.amount), 0);

    const total = income - expense;

    netBalanceElement.innerText = `₺${formatMoney(total)}`;
    totalIncomeElement.innerText = `₺${formatMoney(income)}`;
    totalExpenseElement.innerText = `₺${formatMoney(expense)}`;
}

// Chart Logic (Same as script.js)
Chart.defaults.color = '#ffffff';
Chart.defaults.font.family = "'Outfit', sans-serif";
const VIBRANT_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#8b5cf6'];

function renderChart(transactions) {
    const ctx = document.getElementById('analysisChart').getContext('2d');
    const expenses = transactions.filter(t => t.type === 'expense');
    const categories = {};

    expenses.forEach(t => {
        const cat = t.category || 'Diğer';
        categories[cat] = (categories[cat] || 0) + t.amount;
    });

    const hasExpenses = Object.keys(categories).length > 0;
    let labels, data, colors;

    if (hasExpenses) {
        labels = Object.keys(categories);
        data = Object.values(categories);
        colors = VIBRANT_COLORS;
    } else {
        const income = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
        labels = ['Gelir', 'Gider'];
        data = [income, expense];
        colors = ['#10b981', '#ef4444'];
    }

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#ffffff' } },
                title: { display: true, text: hasExpenses ? 'Gider Dağılımı' : 'Gelir - Gider', color: '#ffffff' }
            }
        }
    });

    updatePercentSummary(labels, data, colors);
}

function updatePercentSummary(labels, data, colors) {
    const percentSummary = document.getElementById('percent-summary');
    if (percentSummary) {
        percentSummary.innerHTML = '';
        const total = data.reduce((a, b) => a + b, 0);
        labels.forEach((label, i) => {
            const percentage = total > 0 ? ((data[i] / total) * 100).toFixed(1) : 0;
            const li = document.createElement('li');
            li.style.color = '#ffffff';
            li.innerHTML = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${colors[i % colors.length]}; margin-right:8px;"></span><strong>%${percentage}</strong> - ${label}`;
            percentSummary.appendChild(li);
        });
    }
}

// Reuse Advanced Stats
function calculateAdvancedStats(transactions) {
    const incomeFreqEl = document.getElementById('income-frequency');
    const expenseFreqEl = document.getElementById('expense-frequency');
    const forecastBalanceEl = document.getElementById('forecast-balance');
    const forecastTrendEl = document.getElementById('forecast-trend');

    const incomes = transactions.filter(t => t.type === 'income').sort((a, b) => a.date.toDate() - b.date.toDate());
    const expenses = transactions.filter(t => t.type === 'expense').sort((a, b) => a.date.toDate() - b.date.toDate());

    const getFrequency = (list) => {
        if (list.length < 2) return "Veri yetersiz";
        const first = list[0].date.toDate();
        const last = list[list.length - 1].date.toDate();
        const diffDays = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
        const avgDays = (diffDays / (list.length - 1)).toFixed(1);
        return `Ort. ${avgDays} günde bir`;
    };

    if (incomeFreqEl) incomeFreqEl.querySelector('span').textContent = getFrequency(incomes);
    if (expenseFreqEl) expenseFreqEl.querySelector('span').textContent = getFrequency(expenses);

    // Simple Forecast
    const currentBalance = transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
    forecastBalanceEl.textContent = `₺${formatMoney(currentBalance)}`;
}

// Helpers
function formatMoney(amount) {
    return Number(amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function openReceipt(transactionId) {
    const transaction = allTransactions.find(t => t.id === transactionId);
    if (transaction && transaction.receiptUrl) {
        const win = window.open();
        win.document.write('<iframe src="' + transaction.receiptUrl + '" frameborder="0" style="border:0; width:100%; height:100%;" allowfullscreen></iframe>');
    }
}

// Exports
function exportToExcel() {
    let csvContent = "data:text/csv;charset=utf-8,Tarih,Aciklama,Kategori,Tutar,Tur,Ekleyen\r\n";
    allTransactions.forEach(row => {
        const date = row.date ? row.date.toDate().toLocaleDateString('tr-TR') : '';
        const type = row.type === 'income' ? 'Gelir' : 'Gider';
        csvContent += `${date},${row.description},${row.category || '-'},${row.amount},${type},${row.addedBy}\r\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "musteri_raporu.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Müşteri Finansal Raporu", 14, 22);
    // ... Simplified PDF generation ...
    // AutoTable
    const tableColumn = ["Tarih", "Aciklama", "Kategori", "Tutar", "Tur", "Ekleyen"];
    const tableRows = [];
    allTransactions.forEach(row => {
        const date = row.date ? row.date.toDate().toLocaleDateString('tr-TR') : '';
        const type = row.type === 'income' ? 'Gelir' : 'Gider';
        tableRows.push([date, row.description, row.category || '-', `₺${formatMoney(row.amount)}`, type, row.addedBy || '-']);
    });
    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 30 });
    doc.save("musteri_raporu.pdf");
}
