import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  active: boolean;
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', active: false },
    { label: 'Machines', icon: 'settings', route: '/machines', active: false },
    { label: 'Analyses', icon: 'analytics', route: '/analyses', active: false }
  ];

  collapsed: boolean = false;

  constructor(private router: Router) {
    this.setActiveMenuItem();
  }

  toggleSidebar(): void {
    this.collapsed = !this.collapsed;
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
    this.setActiveMenuItem();
  }

  private setActiveMenuItem(): void {
    const currentRoute = this.router.url;
    this.menuItems.forEach(item => {
      item.active = currentRoute === item.route;
    });
  }
}