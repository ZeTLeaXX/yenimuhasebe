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

// Auth Listener
Auth.initAuthListener((user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        currentUser = user;
        document.getElementById('user-display').textContent = user.username || user.email;
        if (user.isAdmin) {
            document.getElementById('admin-link').style.display = 'flex';
        }

        // Logout Handler
        const logoutBtn = document.getElementById('logout-btn');
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        newLogoutBtn.addEventListener('click', () => Auth.logout());

        initTransactions();
    }
});

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

// Chart.js Rendering
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
        colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#6366f1'];
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
                    labels: { color: 'white' }
                },
                title: {
                    display: true,
                    text: hasExpenses ? 'Gider Dağılımı' : 'Gelir - Gider Dengesi',
                    color: 'white'
                }
            }
        }
    });
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

    const tableColumn = ["Tarih", "Aciklama", "Kategori", "Tutar", "Tur", "Ekleyen"];
    const tableRows = [];

    // Sort transactions by date (Ascending: Oldest first, Newest last)
    // User request: "eski tarihten yeni tarihe doğru sıralama yapsın"
    const sortedTransactions = [...allTransactions].sort((a, b) => {
        const dateA = a.date ? a.date.toDate() : new Date(0);
        const dateB = b.date ? b.date.toDate() : new Date(0);
        return dateA - dateB; // Ascending
    });

    let totalIncome = 0;
    let totalExpense = 0;

    sortedTransactions.forEach(row => {
        const date = row.date ? row.date.toDate().toLocaleDateString('tr-TR') : '';
        const type = row.type === 'income' ? 'Gelir' : 'Gider';

        // Calculate totals
        if (row.type === 'income') totalIncome += Number(row.amount);
        if (row.type === 'expense') totalExpense += Number(row.amount);

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
        startY: 40,
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
    doc.text(`Toplam Gelir: ₺${formatMoney(totalIncome)}`, 14, finalY);

    doc.setTextColor(239, 68, 68); // Danger Color
    doc.text(`Toplam Gider: ₺${formatMoney(totalExpense)}`, 14, finalY + 7);

    const netBalance = totalIncome - totalExpense;
    doc.setTextColor(99, 102, 241); // Primary Color
    doc.text(`Net Bakiye: ₺${formatMoney(netBalance)}`, 14, finalY + 14);

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
