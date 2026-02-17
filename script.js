const form = document.getElementById('transaction-form');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category');

const transactionList = document.getElementById('transaction-list');
const totalIncomeElement = document.getElementById('total-income');
const totalExpenseElement = document.getElementById('total-expense');
const netBalanceElement = document.getElementById('net-balance');

// Filters
const searchInput = document.getElementById('search-input');
const filterType = document.getElementById('filter-type');

// Chart
let myChart = null;

let currentUser = null;
let allTransactions = []; // Local copy for filtering
let allCategories = []; // Dynamic Categories

// Category DOM Elements
const categorySelect = document.getElementById('category');
const manageCatsBtn = document.getElementById('manage-cats-btn');
const categoryModal = document.getElementById('category-modal');
const closeCatModal = document.getElementById('close-cat-modal');
const newCatInput = document.getElementById('new-cat-input');
const addCatBtn = document.getElementById('add-cat-btn');
const categoryListManager = document.getElementById('category-list-manager');

// Auth Listener
Auth.initAuthListener(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        currentUser = user;
        document.getElementById('user-display').textContent = user.username || user.email;
        if (user.isAdmin) {
            document.getElementById('admin-link').style.display = 'flex';
        }

        // Display Version
        try {
            if (window.electronAPI && window.electronAPI.getAppVersion) {
                const version = await window.electronAPI.getAppVersion();
                document.getElementById('version-display').textContent = `v${version}`;
            }
        } catch (e) {
            console.warn("Version could not be loaded:", e);
        }

        // Logout Handler
        const logoutBtn = document.getElementById('logout-btn');
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        newLogoutBtn.addEventListener('click', () => Auth.logout());

        // Copy Customer Link Handler
        const copyLinkBtn = document.getElementById('copy-customer-link-btn');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', () => {
                if (currentUser && currentUser.companyId) {
                    // Construct a generic web-ready link assuming equivalent hosting structure
                    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
                    const link = `${baseUrl}/customer.html?id=${currentUser.companyId}`;

                    navigator.clipboard.writeText(link).then(() => {
                        alert("Müşteri paneli linki kopyalandı:\n" + link + "\n\nBu linki müşterilerinize gönderebilirsiniz.");
                    }).catch(err => {
                        console.error('Link kopyalanamadı:', err);
                        prompt("Link kopyalanamadı. Lütfen manuel seçin:", link);
                    });
                }
            });
        }

        // Init Data
        await loadCategories();
        initTransactions();

        // Category Events
        setupCategoryEvents();
    }
});

// --- Category Management ---
function setupCategoryEvents() {
    manageCatsBtn.addEventListener('click', () => {
        categoryModal.style.display = 'flex';
        renderCategoryManager();
    });

    closeCatModal.addEventListener('click', () => {
        categoryModal.style.display = 'none';
    });

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target == categoryModal) {
            categoryModal.style.display = 'none';
        }
    });

    addCatBtn.addEventListener('click', addNewCategory);
}

async function loadCategories() {
    if (!currentUser.companyId) return;

    // Default Categories
    const defaultCategories = [
        "Maaş", "Satış", "Yatırım", "Kira",
        "Fatura", "Market", "Ulaşım", "Eğlence",
        "Sağlık", "Diğer"
    ];

    try {
        const docRef = db.collection('settings').doc(currentUser.companyId);
        const doc = await docRef.get();

        if (doc.exists && doc.data().categories) {
            allCategories = doc.data().categories;
        } else {
            // First time: save defaults
            allCategories = [...defaultCategories];
            await docRef.set({ categories: allCategories }, { merge: true });
        }

        populateCategorySelect();

    } catch (error) {
        console.error("Error loading categories:", error);
        allCategories = [...defaultCategories];
        populateCategorySelect();
    }
}

function populateCategorySelect() {
    categorySelect.innerHTML = '';
    allCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });
}

function renderCategoryManager() {
    categoryListManager.innerHTML = '';
    allCategories.forEach((cat, index) => {
        const li = document.createElement('li');
        li.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 0.5rem 1rem; border-radius: 8px;";

        li.innerHTML = `
            <span>${cat}</span>
            <button onclick="deleteCategory(${index})" style="background:none; border:none; color:var(--danger-color); cursor:pointer;">
                <i class="fas fa-trash"></i>
            </button>
        `;
        categoryListManager.appendChild(li);
    });
}

async function addNewCategory() {
    const name = newCatInput.value.trim();
    if (!name) return;

    if (allCategories.includes(name)) {
        alert("Bu kategori zaten mevcut.");
        return;
    }

    allCategories.push(name);
    newCatInput.value = '';

    await saveCategories();
    populateCategorySelect();
    renderCategoryManager();
}

window.deleteCategory = async function (index) {
    if (confirm(`${allCategories[index]} kategorisini silmek istediğinize emin misiniz?`)) {
        allCategories.splice(index, 1);
        await saveCategories();
        populateCategorySelect();
        renderCategoryManager();
    }
};

async function saveCategories() {
    try {
        await db.collection('settings').doc(currentUser.companyId).set({
            categories: allCategories
        }, { merge: true });
    } catch (error) {
        console.error("Error saving categories:", error);
        alert("Kategori kaydedilirken hata oluştu.");
    }
}

function initTransactions() {
    // Realtime Listener
    // Note: Removed orderBy to avoid index issues. Sorting client-side.
    if (!currentUser.companyId) {
        console.error("User has no company ID!");
        return;
    }

    db.collection('transactions')
        .where('companyId', '==', currentUser.companyId)
        .onSnapshot(snapshot => {
            allTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Client-side Sort (Newest Date First)
            allTransactions.sort((a, b) => {
                const dateA = a.date ? a.date.toDate() : new Date(0);
                const dateB = b.date ? b.date.toDate() : new Date(0);
                return dateB - dateA;
            });

            applyFilters();
        }, error => {
            console.error("Error loading transactions:", error);
            // alert("Veriler yüklenirken hata oluştu: " + error.message);
        });
}

// Filter Logic
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
    updateValues(filtered); // Calculate totals based on filtered view? Usually totals should be GLOBAL. 
    // Let's keep totals GLOBAL (based on allTransactions) but show filtered list.
    // Actually, usually users want to see totals of what they see. Let's do totals of ALL first.
    updateValues(allTransactions);
    renderChart(allTransactions);
    calculateAdvancedStats(allTransactions);
}

// Event Listeners for Filters
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

        // Date
        const dateStr = transaction.date && transaction.date.toDate ? transaction.date.toDate().toLocaleDateString('tr-TR') : 'Tarih Yok';

        const item = document.createElement('li');
        item.classList.add('transaction-item', itemClass);

        item.innerHTML = `
            <div class="info">
                <h4>${transaction.description} ${categoryLabel}</h4>
                <span class="date">${dateStr} • ${transaction.addedBy || 'Anonim'}</span>
            </div>
            <div class="amount-action">
                <span class="amount">${sign}₺${formatMoney(transaction.amount)}</span>
                <button class="delete-btn" onclick="removeTransaction('${transaction.id}')">
                    <i class="fas fa-trash"></i>
                </button>
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

// Chart Global Defaults
Chart.defaults.color = '#ffffff';
Chart.defaults.font.family = "'Outfit', sans-serif";

// Vibrant Color Palette for many categories
const VIBRANT_COLORS = [
    '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7',
    '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#8b5cf6',
    '#06b6d4', '#d946ef', '#84cc16', '#f43f5e', '#2dd4bf',
    '#eab308', '#6366f1', '#fb923c', '#4ade80', '#60a5fa'
];

function renderChart(transactions) {
    const ctx = document.getElementById('analysisChart').getContext('2d');

    // Group expenses by category
    const expenses = transactions.filter(t => t.type === 'expense');
    const categories = {};

    expenses.forEach(t => {
        const cat = t.category || 'Diğer';
        categories[cat] = (categories[cat] || 0) + t.amount;
    });

    // If no expenses, show income vs expense
    const hasExpenses = Object.keys(categories).length > 0;

    let labels, data, colors;

    if (hasExpenses) {
        labels = Object.keys(categories);
        data = Object.values(categories);
        colors = VIBRANT_COLORS;
    } else {
        // Show Income vs Expense general
        const income = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
        labels = ['Gelir', 'Gider'];
        data = [income, expense];
        colors = ['#10b981', '#ef4444'];
    }

    if (myChart) {
        myChart.destroy();
    }

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
                legend: {
                    position: 'right',
                    labels: {
                        color: '#ffffff', // Explicitly bright white
                        font: {
                            size: 13,
                            family: "'Outfit', sans-serif",
                            weight: '500'
                        },
                        padding: 20,
                        generateLabels: (chart) => {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return {
                                        text: `${label}: %${percentage} (₺${formatMoney(value)})`,
                                        fillStyle: data.datasets[0].backgroundColor[i % data.datasets[0].backgroundColor.length],
                                        fontColor: '#ffffff', // Some versions use this
                                        strokeStyle: '#ffffff',
                                        lineWidth: 0,
                                        hidden: isNaN(data.datasets[0].data[i]) || chart.getDatasetMeta(0).data[i].hidden,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ₺${formatMoney(value)} (%${percentage})`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: hasExpenses ? 'Gider Dağılımı' : 'Gelir - Gider Dengesi',
                    color: '#ffffff'
                }
            }
        }
    });

    // Update Percentage Summary List
    const percentSummary = document.getElementById('percent-summary');
    if (percentSummary && hasExpenses) {
        percentSummary.innerHTML = '';
        const total = data.reduce((a, b) => a + b, 0);
        labels.forEach((label, i) => {
            const percentage = ((data[i] / total) * 100).toFixed(1);
            const li = document.createElement('li');
            li.style.color = '#ffffff'; // Legible white text
            li.style.marginBottom = '5px';
            const colorCircle = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${colors[i % colors.length]}; margin-right:8px;"></span>`;
            li.innerHTML = `${colorCircle}<strong>%${percentage}</strong> - ${label}`;
            percentSummary.appendChild(li);
        });
    }
}

// Advanced Analysis Metrics
function calculateAdvancedStats(transactions) {
    const incomeFreqEl = document.getElementById('income-frequency');
    const expenseFreqEl = document.getElementById('expense-frequency');
    const forecastBalanceEl = document.getElementById('forecast-balance');
    const forecastTrendEl = document.getElementById('forecast-trend');

    if (!incomeFreqEl || !expenseFreqEl || !forecastBalanceEl) return;

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

    incomeFreqEl.querySelector('span').textContent = getFrequency(incomes);
    expenseFreqEl.querySelector('span').textContent = getFrequency(expenses);

    // 30 Day Forecast
    // Logic: Calculate daily burn/earn rate over the last 90 days (or all available)
    const now = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(now.getDate() - 90);

    const recentTransactions = transactions.filter(t => t.date.toDate() > ninetyDaysAgo);
    const totalDays = recentTransactions.length > 0 ?
        Math.max(1, (now - Math.min(...recentTransactions.map(t => t.date.toDate()))) / (1000 * 60 * 60 * 24)) : 30;

    const totalRecentIncome = recentTransactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
    const totalRecentExpense = recentTransactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);

    const dailyIncomeRate = totalRecentIncome / totalDays;
    const dailyExpenseRate = totalRecentExpense / totalDays;
    const dailyNet = dailyIncomeRate - dailyExpenseRate;

    const forecast30Days = (dailyNet * 30);
    const currentBalance = transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
    const finalForecast = currentBalance + forecast30Days;

    forecastBalanceEl.textContent = `₺${formatMoney(finalForecast)}`;
    forecastBalanceEl.style.color = finalForecast >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

    if (dailyNet > 0) {
        forecastTrendEl.textContent = "Olumlu trend: Aylık ₺" + formatMoney(forecast30Days) + " artış bekleniyor.";
    } else {
        forecastTrendEl.textContent = "Riskli trend: Aylık ₺" + formatMoney(Math.abs(forecast30Days)) + " azalma bekleniyor.";
    }
}

// Add Transaction
async function addTransaction(e) {
    e.preventDefault();
    console.log("Add Transaction Triggered"); // DEBUG

    try {
        const typeInput = document.querySelector('input[name="type"]:checked');
        if (!typeInput) throw new Error("İşlem türü (Gelir/Gider) seçilmedi!");
        const type = typeInput.value;
        const description = descriptionInput.value;
        const amount = +amountInput.value;
        const category = categoryInput.value;

        if (!currentUser) throw new Error("Oturum açmış kullanıcı bulunamadı!");
        // alert(`Kullanıcı: ${currentUser.email}, Şirket: ${currentUser.companyId}`); // Debugging user state

        const dateInput = document.getElementById('transaction-date');
        const dateValue = dateInput.value;

        // File Upload
        const fileInput = document.getElementById('receipt-file');
        const file = fileInput.files[0];
        let receiptUrl = null;

        if (description.trim() === '' || amount === 0) {
            alert('Lütfen açıklama ve tutar alanlarını doldurunuz.');
            return;
        }

        // Process File (Convert to Base64)
        if (file) {
            try {
                if (file.size > 2 * 1024 * 1024) { // Check original size (2MB limit before compression)
                    alert("Dosya boyutu çok yüksek. Lütfen daha küçük bir dosya seçin.");
                    return;
                }
                receiptUrl = await compressImage(file);
            } catch (error) {
                console.error("File processing error:", error);
                alert("Dosya işlenirken hata oluştu: " + error.message);
                return;
            }
        }

        let transactionDate;
        if (dateValue) {
            const dateObj = new Date(dateValue);
            transactionDate = firebase.firestore.Timestamp.fromDate(dateObj);
        } else {
            transactionDate = firebase.firestore.FieldValue.serverTimestamp();
        }

        const transaction = {
            description,
            amount,
            type,
            category,
            date: transactionDate,
            userId: currentUser.uid,
            companyId: currentUser.companyId, // Shared Workspace ID
            companyCode: currentUser.companyCode,
            addedBy: currentUser.username || currentUser.email,
            receiptUrl: receiptUrl
        };

        try {
            await db.collection('transactions').add(transaction);
            descriptionInput.value = '';
            amountInput.value = '';
            dateInput.value = '';
            fileInput.value = ''; // Clear file input
        } catch (error) {
            console.error('Error adding transaction: ', error);
            alert('İşlem eklenirken hata oluştu: ' + error.message);
        }
    } catch (outerError) {
        console.error("Critical error in addTransaction:", outerError);
        alert("Beklenmeyen Hata: " + outerError.message);
    }
}

// Helper: Compress Image and Convert to Base64
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxWidth = 800;
                const maxHeight = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG with 0.7 quality
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

// Update DOM to show attachment icon
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

        // Attachment Icon (Base64 URL works same as HTTPS URL)
        const attachmentIcon = transaction.receiptUrl ?
            `<a href="#" onclick="openReceipt('${transaction.id}')" title="Fişi Görüntüle" style="color:var(--accent-color); margin-left:5px;"><i class="fas fa-paperclip"></i></a>` : '';

        const dateStr = transaction.date && transaction.date.toDate ? transaction.date.toDate().toLocaleDateString('tr-TR') : 'Tarih Yok';

        const item = document.createElement('li');
        item.classList.add('transaction-item', itemClass);

        item.innerHTML = `
            <div class="info">
                <h4>${transaction.description} ${categoryLabel} ${attachmentIcon}</h4>
                <span class="date">${dateStr} • ${transaction.addedBy || 'Anonim'}</span>
            </div>
            <div class="amount-action">
                <span class="amount">${sign}₺${formatMoney(transaction.amount)}</span>
                <button class="delete-btn" onclick="removeTransaction('${transaction.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        transactionList.appendChild(item);
    });
}

// Function to open receipt in a new window (safest for Base64)
function openReceipt(transactionId) {
    const transaction = allTransactions.find(t => t.id === transactionId);
    if (transaction && transaction.receiptUrl) {
        const win = window.open();
        win.document.write('<iframe src="' + transaction.receiptUrl + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
    }
}

// Remove Transaction
async function removeTransaction(id) {
    if (confirm('Bu işlemi silmek istediğinize emin misiniz?')) {
        try {
            await db.collection('transactions').doc(id).delete();
        } catch (error) {
            console.error('Error removing document: ', error);
        }
    }
}

// Excel Export
function exportToExcel() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Tarih,Aciklama,Kategori,Tutar,Tur,Ekleyen\r\n";

    allTransactions.forEach(row => {
        const date = row.date ? row.date.toDate().toLocaleDateString('tr-TR') : '';
        const type = row.type === 'income' ? 'Gelir' : 'Gider';
        csvContent += `${date},${row.description},${row.category || '-'},${row.amount},${type},${row.addedBy}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "muhasebe_kayitlari.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// PDF Export
async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Load Turkish font (Roboto)
    try {
        const fontResponse = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf');
        const fontBuffer = await fontResponse.arrayBuffer();
        const fontBase64 = arrayBufferToBase64(fontBuffer);

        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');
    } catch (error) {
        console.error("Font loading error:", error);
        // Fallback to default if font fails
    }

    doc.setFontSize(18);
    doc.text("Muhasebe Raporu", 14, 22);
    doc.setFontSize(11);
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

    // Capture Chart Image (High Quality & Without Legend)
    const chartCanvas = document.getElementById('analysisChart');
    let chartImage = null;
    if (chartCanvas && myChart) {
        // Create a temporary hi-res canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1500; // Large size for professional sharpness
        tempCanvas.height = 1500;
        const tempCtx = tempCanvas.getContext('2d');

        // Create a temporary high-resolution chart
        const tempChart = new Chart(tempCtx, {
            type: 'doughnut',
            data: JSON.parse(JSON.stringify(myChart.data)),
            options: {
                responsive: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    title: { display: false }
                }
            }
        });

        chartImage = tempCanvas.toDataURL('image/png', 1.0);
        tempChart.destroy();
    }

    // Analysis Summary in PDF (Professional Layout)
    let summaryY = 42;
    doc.setFont("Roboto", "normal");
    doc.setFontSize(16);
    doc.setTextColor(99, 102, 241);
    doc.text("Finansal Analiz Ozeti", 14, summaryY); // Avoiding special chars in titles just in case

    // Draw a subtle line under header
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.line(14, summaryY + 2, 196, summaryY + 2);

    summaryY += 12;

    const expensesForAnalysis = allTransactions.filter(t => t.type === 'expense');
    const totalExpenseForAnalysis = expensesForAnalysis.reduce((a, b) => a + b.amount, 0);
    const categoryMap = {};
    expensesForAnalysis.forEach(t => {
        const cat = t.category || 'Diger';
        categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;
    });

    // Add Chart Image if available (Center-Right, No legend)
    if (chartImage) {
        doc.addImage(chartImage, 'PNG', 125, summaryY - 5, 65, 65);
    }

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setFont("Roboto", "normal"); // Systematically use normal to avoid encoding mismatch

    let currentSumY = summaryY + 5;

    // Sort categories by percentage for better reading
    const sortedCats = Object.keys(categoryMap).sort((a, b) => categoryMap[b] - categoryMap[a]);

    sortedCats.forEach((cat, index) => {
        const val = categoryMap[cat];
        const perc = totalExpenseForAnalysis > 0 ? ((val / totalExpenseForAnalysis) * 100).toFixed(1) : 0;

        // Stylish Bullet Point
        doc.setFillColor(99, 102, 241);
        doc.circle(16, currentSumY - 1, 0.8, 'F');

        // Clean text drawing without bold (Bold requires separate font registration)
        doc.text(`${cat}: %${perc} (₺${formatMoney(val)})`, 20, currentSumY);

        currentSumY += 7;
    });

    const startTableY = Math.max(currentSumY + 15, summaryY + 75);
    const tableColumn = ["Tarih", "Aciklama", "Kategori", "Tutar", "Tur", "Ekleyen"];
    const tableRows = [];

    // Sort transactions by date (Ascending: Oldest first, Newest last)
    // User request: "eski tarihten yeni tarihe doğru sıralama yapsın"
    const sortedTransactions = [...allTransactions].sort((a, b) => {
        const dateA = a.date ? a.date.toDate() : new Date(0);
        const dateB = b.date ? b.date.toDate() : new Date(0);
        return dateA - dateB; // Ascending
    });

    let totalIncomePdf = 0;
    let totalExpensePdf = 0;

    sortedTransactions.forEach(row => {
        const date = row.date ? row.date.toDate().toLocaleDateString('tr-TR') : '';
        const type = row.type === 'income' ? 'Gelir' : 'Gider';

        // Calculate totals
        if (row.type === 'income') totalIncomePdf += Number(row.amount);
        if (row.type === 'expense') totalExpensePdf += Number(row.amount);

        const transactionData = [
            date,
            row.description,
            row.category || '-',
            `₺${formatMoney(row.amount)}`,
            type,
            row.addedBy || '-'
        ];
        tableRows.push(transactionData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: startTableY,
        theme: 'grid',
        headStyles: { fillColor: [99, 102, 241] }, // Primary Color
        styles: { font: "Roboto", fontSize: 9 }, // Use Roboto here too
        didDrawPage: function (data) {
            // Header/Footer could go here
        }
    });

    // Add Totals at the bottom
    const finalY = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129); // Success Color
    doc.text(`Toplam Gelir: ₺${formatMoney(totalIncomePdf)}`, 14, finalY);

    doc.setTextColor(239, 68, 68); // Danger Color
    doc.text(`Toplam Gider: ₺${formatMoney(totalExpensePdf)}`, 14, finalY + 7);

    const netBalancePdf = totalIncomePdf - totalExpensePdf;
    doc.setTextColor(99, 102, 241); // Primary Color
    doc.text(`Net Bakiye: ₺${formatMoney(netBalancePdf)}`, 14, finalY + 14);

    doc.save(`muhasebe_raporu_${new Date().toLocaleDateString('tr-TR')}.pdf`);
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function formatMoney(amount) {
    return Number(amount).toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

form.addEventListener('submit', addTransaction);
