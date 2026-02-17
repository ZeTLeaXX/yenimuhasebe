// Check Admin Access
let currentUser = null;

Auth.initAuthListener((user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    // Replace with your actual admin email if you want hardcoded access, 
    // otherwise relies on isAdmin flag from Firestore
    const ADMIN_EMAIL = 'admin@admin.com';
    if (user.email !== ADMIN_EMAIL && !user.isAdmin) {
        alert("Yetkisiz erişim!");
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    loadCompanies();
    loadUsers();
});

// Load Companies
let allCompanies = [];

function loadCompanies() {
    const list = document.getElementById('company-list');
    list.innerHTML = '<div style="text-align:center; padding:1rem;">Yükleniyor...</div>';

    // REMOVED orderBy to avoid index issues. Client-side sorting used instead.
    db.collection('companies').onSnapshot(snapshot => {
        allCompanies = [];
        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-dim);">Henüz şirket yok.</div>';
            return;
        }

        snapshot.forEach(doc => {
            const company = { id: doc.id, ...doc.data() };
            allCompanies.push(company);
        });

        // Client-side sort (Newest first)
        allCompanies.sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA;
        });

        allCompanies.forEach(company => {
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = `
                <div class="user-info">
                    <span class="user-email">${company.name}</span>
                    <span class="user-status">Kod: ${company.code}</span>
                </div>
                <button class="icon-btn delete-btn" onclick="deleteCompany('${company.id}')" style="color:var(--danger-color); background:none; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button>
            `;
            list.appendChild(li);
        });

        // Refresh user list dropdowns as companies might have changed
        loadUsers();
    }, error => {
        console.error("Error loading companies:", error);
        list.innerHTML = `<div style="text-align:center; padding:1rem; color:red;">Hata: ${error.message}</div>`;
    });
}

// Load Users
function loadUsers() {
    const list = document.getElementById('user-list');
    // Don't show loading text if refreshing from company update to avoid flicker
    if (list.children.length === 0) list.innerHTML = '<div style="text-align:center; padding:1rem;">Yükleniyor...</div>';

    db.collection('users').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-dim);">Henüz kullanıcı yok.</div>';
            return;
        }

        snapshot.forEach(doc => {
            const user = { id: doc.id, ...doc.data() };
            const isSelf = currentUser && user.id === currentUser.uid;

            // Badges
            const isAdminBadge = user.isAdmin ? '<span style="color: #fbbf24; font-size: 0.8em; margin-left: 0.5rem;"><i class="fas fa-crown"></i> Admin</span>' : '';
            const bannedBadge = user.isBanned ? '<span style="color: #ef4444; font-size: 0.8em; margin-left: 0.5rem;"><i class="fas fa-ban"></i> Yasaklı</span>' : '';

            // Company Status
            const companySelect = createCompanySelect(user.companyId, user.id);
            const statusBadge = user.companyId ?
                '<span class="status-badge status-active">Aktif</span>' :
                '<span class="status-badge status-pending">Onay Bekliyor</span>';

            // Actions
            let actionButtons = '';
            if (!isSelf) {
                // Admin Toggle
                const adminBtnIcon = user.isAdmin ? 'fa-user-minus' : 'fa-user-plus';
                const adminBtnColor = user.isAdmin ? 'var(--text-dim)' : '#fbbf24';
                actionButtons += `
                    <button onclick="Auth.toggleAdmin('${user.id}')" style="color: ${adminBtnColor}; background:none; border:none; cursor:pointer; margin-right:5px;" title="Yönetici Yetkisi">
                        <i class="fas ${adminBtnIcon}"></i>
                    </button>
                `;

                // Ban Toggle
                const banBtnIcon = user.isBanned ? 'fa-check' : 'fa-ban';
                const banBtnColor = user.isBanned ? '#34d399' : '#ef4444';
                actionButtons += `
                    <button onclick="toggleBan('${user.id}', ${user.isBanned})" style="color: ${banBtnColor}; background:none; border:none; cursor:pointer; margin-right:5px;" title="Yasakla/Kaldır">
                        <i class="fas ${banBtnIcon}"></i>
                    </button>
                `;

                // Delete
                actionButtons += `
                    <button onclick="deleteUser('${user.id}')" style="color: var(--danger-color); background:none; border:none; cursor:pointer;" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
            } else {
                actionButtons = '<span style="font-size: 0.8rem; color: var(--text-dim);">(Siz)</span>';
            }

            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = `
                <div class="user-info">
                    <span class="user-email">${user.email} (${user.username}) ${isAdminBadge} ${bannedBadge}</span>
                    <span class="user-status">${statusBadge}</span>
                </div>
                <div class="action-group" style="display:flex; align-items:center; gap:10px;">
                    ${companySelect}
                    <div style="border-left:1px solid rgba(255,255,255,0.1); padding-left:10px; margin-left:5px;">
                        ${actionButtons}
                    </div>
                </div>
            `;
            list.appendChild(li);
        });
    });
}

// Helper: Create Company Dropdown
function createCompanySelect(currentCompanyId, userId) {
    let options = '<option value="">Şirket Seçin...</option>';

    allCompanies.forEach(company => {
        const selected = company.id === currentCompanyId ? 'selected' : '';
        options += `<option value="${company.id}" ${selected}>${company.name}</option>`;
    });

    return `
        <select onchange="assignUser('${userId}', this.value)" style="padding: 0.3rem; font-size:0.8rem;">
            ${options}
        </select>
    `;
}

// Company Actions
window.showAddCompanyModal = function () {
    console.log("Opening Company Modal");
    const modal = document.getElementById('company-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('new-company-name').value = '';
        document.getElementById('new-company-code').value = '';
        document.getElementById('new-company-name').focus();
    } else {
        console.error("Company modal not found!");
    }
}

window.closeCompanyModal = function () {
    const modal = document.getElementById('company-modal');
    if (modal) modal.style.display = 'none';
}

window.saveCompany = async function () {
    console.log("Starting saveCompany...");

    const nameInput = document.getElementById('new-company-name');
    const codeInput = document.getElementById('new-company-code');

    if (!nameInput || !codeInput) {
        alert("Hata: Form elemanları bulunamadı!");
        return;
    }

    const name = nameInput.value;
    const code = codeInput.value.toUpperCase();

    if (!name || !code) {
        alert("Lütfen tüm alanları doldurun.");
        return;
    }

    try {
        if (!db) {
            throw new Error("Veritabanı bağlantısı (db) bulunamadı!");
        }

        await db.collection('companies').add({
            name,
            code,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeCompanyModal();
    } catch (error) {
        console.error(error);
        alert("HATA OLUŞTU: " + error.message);
    }
}

async function deleteCompany(id) {
    if (confirm("Bu şirketi ve bağlı verileri silmek istediğinizden emin misiniz?")) {
        await db.collection('companies').doc(id).delete();
    }
}

// User Creation Modals
window.showAddUserModal = function () {
    const modal = document.getElementById('user-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('new-user-name').value = '';
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-password').value = '';
        document.getElementById('new-user-name').focus();
    }
}

window.closeUserModal = function () {
    const modal = document.getElementById('user-modal');
    if (modal) modal.style.display = 'none';
}

window.saveUser = async function () {
    const username = document.getElementById('new-user-name').value;
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;

    if (!username || !email || !password) {
        alert("Lütfen tüm alanları doldurun.");
        return;
    }

    try {
        // We use the Auth.register helper we already have
        const result = await Auth.register(username, email, password);
        if (result.success) {
            alert("Kullanıcı başarıyla oluşturuldu.");
            closeUserModal();
        } else {
            alert("Hata: " + result.message);
        }
    } catch (error) {
        console.error(error);
        alert("Sistem hatası: " + error.message);
    }
}

// User Actions
async function assignUser(userId, companyId) {
    try {
        if (!companyId) {
            // Remove assignment
            await db.collection('users').doc(userId).update({
                companyId: firebase.firestore.FieldValue.delete(),
                companyCode: firebase.firestore.FieldValue.delete()
            });
        } else {
            // Find company code
            const company = allCompanies.find(c => c.id === companyId);
            await db.collection('users').doc(userId).update({
                companyId: companyId,
                companyCode: company.code
            });
        }
    } catch (error) {
        console.error(error);
        alert("Atama hatası: " + error.message);
    }
}

function toggleBan(id, currentStatus) {
    if (currentStatus) Auth.unbanUser(id);
    else Auth.banUser(id);
}

function deleteUser(id) {
    if (confirm('Kullanıcı veritabanı kaydını silmek istediğinize emin misiniz?')) {
        db.collection('users').doc(id).delete();
    }
}

// Test Data Generator (Bulk Insert 100)
window.generateTestData = async function () {
    const nameInput = document.getElementById('target-company-name');
    const targetName = nameInput.value.trim();

    if (!targetName) {
        alert("Lütfen şirket adı girin.");
        return;
    }

    // Find company by name (case-insensitive)
    const company = allCompanies.find(c => c.name.toLowerCase() === targetName.toLowerCase());

    if (!company) {
        alert("Şirket bulunamadı! Lütfen tam adını doğru yazdığınızdan emin olun.\nListeden kopyalayabilirsiniz.");
        return;
    }

    if (!confirm(`"${company.name}" şirketi için 100 adet RASTGELE işlem eklenecek.\nBu işlem geri alınamaz (tek tek silmeniz gerekir).\nDevam ediyor musunuz?`)) return;

    // Random Data Source
    const descriptions = ['Ofis Malzemeleri', 'Müşteri Ödemesi', 'Danışmanlık Faturası', 'Sunucu Kirası', 'Çay Kahve', 'Taksi Fişi', 'Yazılım Lisansı', 'Reklam Gideri', 'Personel Avansı', 'Ürün Satışı'];
    const categories = ['Satış', 'Hizmet', 'Genel Gider', 'Ulaşım', 'Yemek', 'Teknoloji', 'Pazarlama', 'Maaş'];

    const batch = db.batch();
    const collectionRef = db.collection('transactions');

    console.log(`Generating 100 transactions for ${company.name}...`);

    // Generate 100 items
    for (let i = 0; i < 100; i++) {
        // Random Logic
        const isIncome = Math.random() > 0.4; // 60% Income
        const type = isIncome ? 'income' : 'expense';
        const amount = Math.floor(Math.random() * 5000) + 100; // 100 - 5100 TL
        const desc = descriptions[Math.floor(Math.random() * descriptions.length)] + ` #${Math.floor(Math.random() * 1000)}`;
        const cat = categories[Math.floor(Math.random() * categories.length)];

        // Random Date (Last 6 Months)
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 180));

        const docRef = collectionRef.doc(); // Auto ID
        batch.set(docRef, {
            description: desc,
            amount: amount,
            type: type,
            category: cat,
            date: firebase.firestore.Timestamp.fromDate(date),
            companyId: company.id,
            companyCode: company.code,
            userId: currentUser.uid,
            addedBy: 'Admin (Test)',
            receiptUrl: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    try {
        await batch.commit();
        alert(`Bitti! "${company.name}" için 100 adet işlem başarıyla eklendi.`);
        nameInput.value = ''; // Reset input
    } catch (error) {
        console.error("Batch insert error:", error);
        alert("Hata oluştu: " + error.message);
    }
}

// --- Uygulama Güncelleme Yönetimi ---
window.publishUpdate = async function () {
    const version = document.getElementById('update-version').value.trim();
    const url = document.getElementById('update-url').value.trim();

    if (!version || !url) {
        alert("Lütfen hem versiyon numarasını hem de indirme linkini girin.");
        return;
    }

    try {
        await rtdb.ref('app_config').set({
            latestVersion: version,
            downloadUrl: url
        });
        alert("Güncelleme başarıyla yayınlandı! Tüm kullanıcılar bir sonraki açılışta bu sürümü görecektir.");
    } catch (error) {
        console.error("Güncelleme yayınlama hatası:", error);
        alert("Hata oluştu: " + error.message);
    }
}

async function loadUpdateSettings() {
    try {
        const snapshot = await rtdb.ref('app_config').once('value');
        const data = snapshot.val();
        if (data) {
            document.getElementById('update-version').value = data.latestVersion || '';
            document.getElementById('update-url').value = data.downloadUrl || '';
        }
    } catch (e) {
        console.warn("Mevcut güncelleme ayarları yüklenemedi:", e);
    }
}

// Sayfa yüklendiğinde mevcut ayarları getir
document.addEventListener('DOMContentLoaded', async () => {
    loadUpdateSettings();

    // Sürümü Görüntüle
    try {
        if (window.electronAPI && window.electronAPI.getAppVersion) {
            const version = await window.electronAPI.getAppVersion();
            document.getElementById('version-display').textContent = `v${version}`;
            const headerVer = document.getElementById('header-version');
            if (headerVer) headerVer.textContent = `(v${version})`;
        }
    } catch (e) {
        console.warn("Sürüm yüklenemedi:", e);
    }
});
