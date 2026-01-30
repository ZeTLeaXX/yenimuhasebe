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
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
            return { success: true, user };
        }
        return { success: false, message: 'Kullanıcı adı veya şifre hatalı.' };
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
