// Auth Logic with Firebase
class Auth {
    // Firebase Auth State Listener
    static initAuthListener(callback) {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Get additional user data from Firestore
                const userDoc = await db.collection('users').doc(user.uid).get();
                const userData = userDoc.exists ? userDoc.data() : null;

                if (userData && userData.isBanned) {
                    await auth.signOut();
                    callback(null); // Treat as logged out
                    alert('Hesabınız yasaklanmıştır.');
                    window.location.href = 'login.html';
                } else {
                    // Merge auth user with firestore data
                    const combinedUser = {
                        uid: user.uid,
                        email: user.email,
                        ...userData
                    };

                    // Check for Pending Status (No Company Assigned)
                    // Skip check for admin panel or if user is admin
                    const currentPath = window.location.pathname;
                    if (!combinedUser.isAdmin && !combinedUser.companyId && !currentPath.includes('pending.html')) {
                        window.location.href = 'pending.html';
                        return;
                    }

                    callback(combinedUser);
                }
            } else {
                callback(null);
            }
        });
    }

    static async register(username, email, password) {
        try {
            // 1. Create User in Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // 2. Add to Firestore (No company assigned initially)
            // Check if this is the first user ever (to make admin)
            const usersSnapshot = await db.collection('users').get();
            const isAdmin = usersSnapshot.empty;

            await db.collection('users').doc(user.uid).set({
                id: user.uid,
                username: username,
                email: email,
                isAdmin: isAdmin, // First user becomes admin
                isBanned: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, message: 'Kayıt başarılı! Yönetici onayı bekleniyor.' };
        } catch (error) {
            return { success: false, message: this.getErrorMessage(error.code) };
        }
    }

    static async login(email, password) {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            // check ban status inside auth listener or here immediately
            const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
            if (userDoc.exists && userDoc.data().isBanned) {
                await auth.signOut();
                return { success: false, message: 'Hesabınız yasaklanmıştır.' };
            }
            return { success: true };
        } catch (error) {
            return { success: false, message: this.getErrorMessage(error.code) };
        }
    }

    static async logout() {
        await auth.signOut();
        window.location.href = 'login.html';
    }

    // Helper: Translate Firebase Errors to Turkish
    static getErrorMessage(code) {
        switch (code) {
            case 'auth/email-already-in-use': return 'Bu e-posta adresi zaten kullanımda.';
            case 'auth/invalid-email': return 'Geçersiz e-posta adresi.';
            case 'auth/weak-password': return 'Şifre çok zayıf (en az 6 karakter).';
            case 'auth/user-not-found': return 'Kullanıcı bulunamadı.';
            case 'auth/wrong-password': return 'Hatalı şifre.';
            default: return 'Bir hata oluştu: ' + code;
        }
    }

    // Admin Helpers
    static async banUser(uid) {
        try {
            await db.collection('users').doc(uid).update({ isBanned: true });
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    static async unbanUser(uid) {
        try {
            await db.collection('users').doc(uid).update({ isBanned: false });
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    static async toggleAdmin(uid) {
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (!doc.exists) return;
            const currentStatus = doc.data().isAdmin;
            await db.collection('users').doc(uid).update({ isAdmin: !currentStatus });
        } catch (e) {
            console.error(e);
        }
    }
}
