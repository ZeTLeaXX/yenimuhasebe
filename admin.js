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
