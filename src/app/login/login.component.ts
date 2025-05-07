import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isSubmitting = false;
  errorMessage = '';
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.initForm();
  }

  initForm(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.value;
    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const result = await this.authService.signIn(email, password);
      if (true) {
        //const token = await result.user.getIdToken();
        //localStorage.setItem('token', token);
        //if (result.user.displayName) {
         // localStorage.setItem('displayName', result.user.displayName);
        //}
        this.router.navigate(['/dashboard']);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      switch (error.code) {
        case 'auth/user-not-found':
          this.errorMessage = 'No account found with this email address.';
          break;
        case 'auth/wrong-password':
          this.errorMessage = 'Invalid password. Please try again.';
          break;
        case 'auth/too-many-requests':
          this.errorMessage = 'Too many unsuccessful login attempts. Please try again later.';
          break;
        default:
          this.errorMessage = 'Login failed. Please check your credentials and try again.';
      }
    } finally {
      this.isSubmitting = false;
    }
  }

  async signInWithGoogle(): Promise<void> {
    try {
      // Implementation for Google sign-in would go here
      // You'd need to add this functionality to your AuthService
      // this.authService.signInWithGoogle();
      this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('Google sign-in error:', error);
      this.errorMessage = 'Google sign-in failed. Please try again.';
    }
  }
}