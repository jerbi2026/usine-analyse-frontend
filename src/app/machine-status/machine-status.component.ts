import { Component, OnInit } from '@angular/core';
import { MachineService } from '../services/machine.service';
import { forkJoin, map } from 'rxjs';
import { MachineStatusModel, MachineStopModel, MachineStatusResponse, MachineStopResponse } from '../models/machine.model';


@Component({
  selector: 'app-machine-status',
  templateUrl: './machine-status.component.html',
  styleUrls: ['./machine-status.component.scss']
})
export class MachineStatusComponent implements OnInit {
  machineStatuses: MachineStatusModel[] = [];
  machineStops: MachineStopModel[] = [];
  loading = true;
  error = '';

  constructor(private machineService: MachineService) { }

  ngOnInit(): void {
    this.loadMachineData();
  }

  loadMachineData(): void {
    this.loading = true;
    this.error = '';

    // Using forkJoin to make both API calls in parallel
    forkJoin({
      statuses: this.machineService.getMachineStatus().pipe(
        map((response: any) => {
          const statusResponse = response as MachineStatusResponse;
          const formattedStatuses: MachineStatusModel[] = [];
          
          for (const [machineName, statusValue] of Object.entries(statusResponse.machines)) {
            formattedStatuses.push({
              machine_name: machineName,
              status: this.mapStatusToEnglish(statusValue),
              status_display: statusValue,
              last_updated: statusResponse.timestamp
            });
          }
          
          return formattedStatuses;
        })
      ),
      stops: this.machineService.getMachineStops().pipe(
        map((response: any) => {
          return (response as MachineStopResponse[]).map(stop => ({
            machine_name: stop.machine,
            start_time: stop.start_time,
            end_time: stop.end_time,
            duration_hours: stop.duration_hours
          }));
        })
      )
    }).subscribe({
      next: (result) => {
        this.machineStatuses = result.statuses;
        this.machineStops = result.stops;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading machine data:', err);
        this.error = 'Failed to load machine data. Please try again later.';
        this.loading = false;
      }
    });
  }

  mapStatusToEnglish(frenchStatus: string): string {
    switch (frenchStatus.toLowerCase()) {
      case 'en fonctionnement':
        return 'running';
      case 'arrêté':
      case 'arrete':
        return 'stopped';
      case 'avertissement':
        return 'warning';
      default:
        return 'unknown';
    }
  }

  getLatestStopForMachine(machineName: string): MachineStopModel | undefined {
    // Filter stops for this machine and sort by start time (most recent first)
    const machineStops = this.machineStops
      .filter(stop => stop.machine_name === machineName)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    
    return machineStops.length > 0 ? machineStops[0] : undefined;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'running': 
        return 'status-running';
      case 'stopped': 
        return 'status-stopped';
      case 'warning': 
        return 'status-warning';
      default: 
        return '';
    }
  }

  formatDuration(stop: MachineStopModel): string {
    if (stop.duration_hours !== undefined) {
      const hours = Math.floor(stop.duration_hours);
      const minutes = Math.round((stop.duration_hours - hours) * 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${minutes}m`;
      }
    } else if (stop.end_time === null) {
      // Calculate duration for ongoing stops
      const startTime = new Date(stop.start_time);
      const now = new Date();
      const durationHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      
      const hours = Math.floor(durationHours);
      const minutes = Math.round((durationHours - hours) * 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes}m (ongoing)`;
      } else {
        return `${minutes}m (ongoing)`;
      }
    }
    
    return 'Unknown';
  }

  refresh(): void {
    this.loadMachineData();
  }
  
  getStopHistoryForMachine(machineName: string): MachineStopModel[] {
    return this.machineStops
      .filter(stop => stop.machine_name === machineName)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }
}