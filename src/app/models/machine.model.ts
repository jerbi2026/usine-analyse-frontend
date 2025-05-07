export interface MachineData {
    [key: string]: number | string | any;
    id: number;
    Timestamp: string;
    G19: number;
    G26: number;
    MISFAT_3_D02_01_M43: number;
    MISFAT_3_D18f: number;
    MISFAT_3_G10f: number;
    MISFAT_3_G33_: number;
    MISFAT_3_G39f: number;
    MISFAT_3_H46f: number;
    MISFAT_3_H53: number;
    MISFAT_3_N11: number;
  }
  
  export interface MachineStatus {
    machine_name: string;
    status: 'running' | 'stopped' | 'warning';
    last_updated: string;
  }
  
  export interface MachineStop {
    machine_name: string;
    start_time: string;
    end_time: string | null;
    duration_minutes?: number;
    reason?: string;
  }
  
  export interface AlertRequest {
    anomalies: Array<{
      machine_name: string;
      value: number;
      threshold: number;
      timestamp: string;
    }>;
    model_name: string;
  }
  
  export interface MonitoringRequest {
    frequence_minutes: number;
  }
  
  export interface ApiResponse<T> {
    status?: string;
    message?: string;
    data?: T;
    error?: string;
  }
  
  export interface MachineStatusResponse {
    machines: {
      [key: string]: string;
    };
    timestamp: string;
  }
  
  export interface MachineStopResponse {
    duration_hours: number;
    end_time: string | null;
    machine: string;
    start_time: string;
  }
  
  export interface MachineStatusModel {
    machine_name: string;
    status: string;
    status_display: string;
    last_updated: string;
  }
  
  export interface MachineStopModel {
    machine_name: string;
    start_time: string;
    end_time: string | null;
    duration_hours: number;
  }
  
  
  export interface AnomalyDetectionResult {
    [machine_name: string]: {
      anomalies: Array<{
        timestamp: string;
        value: number;
        threshold?: number;
      }>;
      model_info?: {
        type: string;
        parameters?: any;
      };
      stats?: {
        total: number;
        by_day?: { [date: string]: number };
      };
    } | {
      summary?: {
        total_anomalies: number;
        affected_machines: string[];
      };
      period?: {
        start: string;
        end: string;
      };
    };
  }
  
  export interface HistoricalAnomalyRequest {
    start_date?: string;
    end_date?: string;
    machines?: string[];
  }
  
  export interface HistoricalAnomalyResult {
    [machine_name: string]: {
      anomalies: Array<{
        timestamp: string;
        value: number;
        threshold?: number;
      }>;
      stats?: {
        total: number;
        by_day?: { [date: string]: number };
      };
    } | {
      period?: {
        start: string;
        end: string;
      };
    };
  }
  
  export interface MachineAnalysisRequest {
    machine: string;
    data: Array<{
      [key: string]: number | string | undefined;
      timestamp?: string;
      Timestamp?: string;
    }>;
  }