import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MachineData, MachineStatus, MachineStop, AlertRequest, ApiResponse, MonitoringRequest } from '../models/machine.model';


@Injectable({
  providedIn: 'root'
})
export class MachineService {
  private apiUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient) { }

  
  getMachineData(): Observable<MachineData[]> {
    return this.http.get<MachineData[]>(`${this.apiUrl}/machine-data`);
  }

 
  getMachineStatus(): Observable<MachineStatus[]> {
    return this.http.get<MachineStatus[]>(`${this.apiUrl}/machine-status`);
  }

 
  getMachineStops(): Observable<MachineStop[]> {
    return this.http.get<MachineStop[]>(`${this.apiUrl}/machine-stops`);
  }

  
  sendAlert(alertData: AlertRequest): Observable<ApiResponse<null>> {
    return this.http.post<ApiResponse<null>>(`${this.apiUrl}/send-alert`, alertData);
  }

  
  startMonitoring(frequenceMinutes: number = 60): Observable<ApiResponse<null>> {
    const data: MonitoringRequest = { frequence_minutes: frequenceMinutes };
    return this.http.post<ApiResponse<null>>(`${this.apiUrl}/start-monitoring`, data);
  }
}