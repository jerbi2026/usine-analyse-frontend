import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { GoogleAuthProvider } from 'firebase/auth';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Use any to avoid type conflicts between different rxjs versions
  user$: any;

  constructor(private afAuth: AngularFireAuth, private router: Router) {
    // Initialize the user$ Observable in the constructor
    this.user$ = this.afAuth.authState;
  }

  signUp(email: string, password: string) {
    return this.afAuth.createUserWithEmailAndPassword(email, password);
  }

  signIn(email: string, password: string) {
    return this.afAuth.signInWithEmailAndPassword(email, password)
      .then((result) => {
        // Store user token after successful sign-in
        result.user?.getIdToken().then(token => {
          localStorage.setItem('token', token);
          if (result.user?.displayName) {
            localStorage.setItem('displayName', result.user.displayName);
          }
        });
        this.router.navigate(['dashboard']);
      });
  }

  signOut() {
    localStorage.removeItem('token');
    localStorage.removeItem('displayName');
    return this.afAuth.signOut().then(() => {
      this.router.navigate(['login']);
    });
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  async getCurrentUserToken(): Promise<string | null> {
    const user = await this.afAuth.currentUser;
    if (user) {
      const idToken = await user.getIdToken();
      return idToken;
    }
    return null;
  }

  getUser() {
    return this.afAuth.authState;
  }

  // Optional: Add Google Sign-in method if you need it
  signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    return this.afAuth.signInWithPopup(provider)
      .then((result) => {
        result.user?.getIdToken().then(token => {
          localStorage.setItem('token', token);
          if (result.user?.displayName) {
            localStorage.setItem('displayName', result.user.displayName);
          }
        });
        this.router.navigate(['dashboard']);
      });
  }
}