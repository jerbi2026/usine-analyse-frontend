import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit{
  userName: string = 'John Doe';
  
  constructor(private router: Router) {}
  ngOnInit(): void {
     this.userName = localStorage.getItem('displayName') || 'John Doe';
  }

  logout(): void {
    this.router.navigate(['/auth/login']);
  }
}