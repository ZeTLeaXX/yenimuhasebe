// Auth Logic
const USERS_KEY = 'muhasebe_users';
const CURRENT_USER_KEY = 'muhasebe_current_user';

class Auth {
    static getUsers() {
        return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    }

    static register(username, password) {
        const users = this.getUsers();
        if (users.find(u => u.username === username)) {
            return { success: false, message: 'Bu kullanıcı adı zaten alınmış.' };
        }

        const newUser = {
            id: Date.now(),
            username,
            password, // In a real app, hash this!
            isAdmin: users.length === 0 // First user is admin
        };

        users.push(newUser);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        return { success: true, message: 'Kayıt başarılı! Giriş yapabilirsiniz.' };
    }

    static login(username, password) {
        const users = this.getUsers();
        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            if (user.isBanned) {
                return { success: false, message: 'Hesabınız yasaklanmıştır. Lütfen yönetici ile iletişime geçin.' };
            }
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
            return { success: true, user };
        }
        return { success: false, message: 'Kullanıcı adı veya şifre hatalı.' };
    }

    static banUser(id) {
        let users = this.getUsers();
        const userIndex = users.findIndex(u => u.id === id);
        if (userIndex !== -1) {
            users[userIndex].isBanned = true;
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            return true;
        }
        return false;
    }

    static unbanUser(id) {
        let users = this.getUsers();
        const userIndex = users.findIndex(u => u.id === id);
        if (userIndex !== -1) {
            users[userIndex].isBanned = false;
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            return true;
        }
        return false;
    }

    static toggleAdmin(id) {
        let users = this.getUsers();
        const userIndex = users.findIndex(u => u.id === id);
        
        // Prevent removing own admin rights if it's the current user (safety check done in UI mostly but good here too)
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.id === id && users[userIndex].isAdmin) {
             // Optional: prevent self-demotion logic if needed, but basic implementation allows flexibility
        }

        if (userIndex !== -1) {
            users[userIndex].isAdmin = !users[userIndex].isAdmin;
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            return users[userIndex].isAdmin;
        }
        return null; // User not found
    }

    static logout() {
        localStorage.removeItem(CURRENT_USER_KEY);
        window.location.href = 'login.html';
    }

    static getCurrentUser() {
        return JSON.parse(localStorage.getItem(CURRENT_USER_KEY));
    }

    static requireAuth() {
        const user = this.getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return null;
        }
        return user;
    }

    static requireAdmin() {
        const user = this.requireAuth();
        if (user && !user.isAdmin) {
            alert('Bu sayfaya erişim yetkiniz yok.');
            window.location.href = 'index.html';
            return null;
        }
        return user;
    }
}
