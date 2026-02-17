// Global Variables
let allHistoryTransactions = [];
let currentUser = null;

// Initialize Auth
Auth.initAuthListener(async (user) => {
    if (user) {
        currentUser = user;

        // Display Version
        try {
            if (window.electronAPI && window.electronAPI.getAppVersion) {
                const version = await window.electronAPI.getAppVersion();
                document.getElementById('version-display').textContent = `v${version}`;
            }
        } catch (e) {
            console.warn("Version could not be loaded:", e);
        }

        loadHistoryTransactions();
    } else {
        window.location.href = 'login.html';
    }
});

// Load Transactions
function loadHistoryTransactions() {
    const tableBody = document.getElementById('history-table-body');

    // Real-time listener
    if (!currentUser.companyId) {
        console.error("User has no company ID!");
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--danger-color);">Firma bilgisi bulunamadı.</td></tr>';
        return;
    }

    db.collection('transactions')
        .where('companyId', '==', currentUser.companyId) // Shared Workspace
        // .orderBy('date', 'desc') // REMOVED: Causes Missing Index Error
        .onSnapshot(snapshot => {
            allHistoryTransactions = [];

            snapshot.forEach(doc => {
                allHistoryTransactions.push({ id: doc.id, ...doc.data() });
            });

            // Client-side Sort (Newest Date First)
            allHistoryTransactions.sort((a, b) => {
                const dateA = a.date ? a.date.toDate() : new Date(0);
                const dateB = b.date ? b.date.toDate() : new Date(0);
                return dateB - dateA;
            });

            renderHistoryTable(allHistoryTransactions);
            // Re-apply filters if any
            filterHistory();
        }, error => {
            console.error("Error loading history:", error);
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--danger-color);">Veriler yüklenirken hata oluştu: ' + error.message + '</td></tr>';
        });
}

// Render Table
function renderHistoryTable(transactions) {
    const tableBody = document.getElementById('history-table-body');
    tableBody.innerHTML = '';

    if (transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--text-dim);">Henüz işlem kaydı bulunmuyor.</td></tr>';
        return;
    }

    transactions.forEach(t => {
        const date = t.date ? t.date.toDate().toLocaleDateString('tr-TR') : '-';
        const amountClass = t.type === 'income' ? 'success-color' : 'danger-color';
        const amountStyle = t.type === 'income' ? 'color: var(--success-color);' : 'color: var(--danger-color);';

        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        row.innerHTML = `
            <td style="padding: 1rem; color: var(--text-dim);">${date}</td>
            <td style="padding: 1rem; font-weight: 500;">
                ${t.description}
                ${t.receiptUrl ? `<a href="#" onclick="openHistoryReceipt('${t.id}')" title="Fişi Görüntüle" style="color:var(--accent-color); margin-left:5px;"><i class="fas fa-paperclip"></i></a>` : ''}
            </td>
            <td style="padding: 1rem;">${t.category || '-'}</td>
            <td style="padding: 1rem; font-weight: 600; ${amountStyle}">${t.type === 'income' ? '+' : '-'}₺${formatMoney(t.amount)}</td>
            <td style="padding: 1rem;">
                <button class="icon-btn delete-btn" onclick="deleteTransaction('${t.id}')" title="Sil">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Filter Logic
document.getElementById('history-search').addEventListener('input', filterHistory);
document.getElementById('history-filter').addEventListener('change', filterHistory);

function filterHistory() {
    const searchTerm = document.getElementById('history-search').value.toLowerCase();
    const filterType = document.getElementById('history-filter').value;

    const filtered = allHistoryTransactions.filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchTerm) ||
            (t.category && t.category.toLowerCase().includes(searchTerm));
        const matchesType = filterType === 'all' || t.type === filterType;

        return matchesSearch && matchesType;
    });

    renderHistoryTable(filtered);
}

// Delete Transaction
function deleteTransaction(id) {
    if (confirm('Bu işlemi silmek istediğinize emin misiniz?')) {
        db.collection('transactions').doc(id).delete()
            .then(() => {
                // Toast or notification could be added here
            })
            .catch(error => {
                console.error("Error removing document: ", error);
                alert("Silme işlemi başarısız oldu.");
            });
    }
}

// Format Money
function formatMoney(amount) {
    return Number(amount).toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Open Receipt
function openHistoryReceipt(transactionId) {
    const transaction = allHistoryTransactions.find(t => t.id === transactionId);
    if (transaction && transaction.receiptUrl) {
        const win = window.open();
        win.document.write('<iframe src="' + transaction.receiptUrl + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
    }
}
