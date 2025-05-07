import { Component, OnInit, ViewChild, ElementRef, OnDestroy, HostListener } from '@angular/core';
import { Chart, registerables, ChartOptions } from 'chart.js';
import { Subscription } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import zoomPlugin from 'chartjs-plugin-zoom';
import { 
  MachineData, 
  MachineAnalysisRequest, 
  MachineStopModel,
  AnomalyDetectionResult,
  HistoricalAnomalyRequest
} from '../models/machine.model';
import { MachineService } from '../services/machine.service';

Chart.register(...registerables, zoomPlugin);

@Component({
  selector: 'app-machine-analysis',
  templateUrl: './machine-analysis.component.html',
  styleUrls: ['./machine-analysis.component.scss']
})
export class MachineAnalysisComponent implements OnInit, OnDestroy {
  machineData: MachineData[] = [];
  machineStops: MachineStopModel[] = [];
  anomalies: AnomalyDetectionResult = {};
  
  selectedMachine: string = '';
  availableMachines: string[] = [
    'G19', 'G26', 'MISFAT_3_D02_01_M43', 'MISFAT_3_D18f', 
    'MISFAT_3_G10f', 'MISFAT_3_G33_', 'MISFAT_3_G39f', 
    'MISFAT_3_H46f', 'MISFAT_3_H53', 'MISFAT_3_N11'
  ];
  selectedDateRange: string = '30d';
  selectedMetrics: string[] = [];
  
  isLoading: boolean = false;
  error: string = '';
  
  charts: Chart[] = [];
  chartColors: {[key: string]: string} = {};
  
  isFullscreen: boolean = false;
  fullscreenElement: string | null = null;
  dataSubscription: Subscription | null = null;
  stopsSubscription: Subscription | null = null;
  anomaliesSubscription: Subscription | null = null;
  
  @ViewChild('timeseriesCanvas') timeseriesCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('metricsComparisonCanvas') metricsComparisonCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('anomalyCanvas') anomalyCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('stopsCanvas') stopsCanvas!: ElementRef<HTMLCanvasElement>;
  
  // Date filters
  startDate: string = '';
  endDate: string = '';
  
  // Analysis metrics
  availableMetrics: string[] = [
    'G19', 'G26', 'MISFAT_3_D02_01_M43', 'MISFAT_3_D18f', 
    'MISFAT_3_G10f', 'MISFAT_3_G33_', 'MISFAT_3_G39f', 
    'MISFAT_3_H46f', 'MISFAT_3_H53', 'MISFAT_3_N11'
  ];
  
  // Performance metrics
  totalUptime: number = 0;
  totalDowntime: number = 0;
  efficiencyRate: number = 0;
  anomalyCount: number = 0;
  
  constructor(private machineService: MachineService) {}

  ngOnInit(): void {
    this.initializeChartColors();
    this.setDefaultDateRange();
    
    // Set default selection
    if (this.availableMachines.length > 0) {
      this.selectedMachine = this.availableMachines[0];
      this.loadData();
    }
    
    // Select default metrics
    if (this.selectedMetrics.length === 0 && this.availableMetrics.length > 0) {
      this.selectedMetrics = this.availableMetrics.slice(0, 3); // Select first 3 metrics by default
    }
  }
  
  ngOnDestroy(): void {
    this.unsubscribeAll();
  }

  initializeChartColors(): void {
    // Pre-generate consistent colors for each metric
    this.availableMetrics.forEach(metric => {
      this.chartColors[metric] = this.getUniqueColor(metric);
    });
  }
  
  setDefaultDateRange(): void {
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    this.endDate = today.toISOString().split('T')[0];
    this.startDate = thirtyDaysAgo.toISOString().split('T')[0];
  }
  
  loadData(): void {
    if (!this.selectedMachine) {
      this.error = 'Please select a machine';
      return;
    }
    
   // this.isLoading = true;
    this.error = '';
    this.unsubscribeAll();
    
    // Load machine data - using the service method without parameters
    // In a real app, you would modify the service to accept parameters
    this.dataSubscription = this.machineService.getMachineData()
      .pipe(
        catchError(err => {
          this.error = `Error loading machine data: ${err.message}`;
          return of([]);
        }),
        finalize(() => {
          if (!this.stopsSubscription && !this.anomaliesSubscription) {
            this.isLoading = false;
          }
        })
      )
      .subscribe(data => {
        // Filter data for selected machine and date range
        const startDate = new Date(this.startDate);
        const endDate = new Date(this.endDate);
        endDate.setHours(23, 59, 59); // End of day
        
        this.machineData = data.filter(item => {
          const timestamp = new Date(item.Timestamp);
          return timestamp >= startDate && timestamp <= endDate;
        });
        
        this.loadMachineStops();
        this.loadAnomalies();
      });
  }
  
  loadMachineStops(): void {
    // Using the service method without parameters 
    // In a real app, you would modify the service to accept parameters
    this.stopsSubscription = this.machineService.getMachineStops()
      .pipe(
        catchError(err => {
          this.error = `Error loading machine stops: ${err.message}`;
          return of([]);
        }),
        finalize(() => {
          if (!this.dataSubscription && !this.anomaliesSubscription) {
            this.isLoading = false;
          }
        })
      )
      .subscribe(stops => {
        const startDate = new Date(this.startDate);
        const endDate = new Date(this.endDate);
        endDate.setHours(23, 59, 59); // End of day
        
        // Transform from MachineStop to MachineStopModel
        // and filter by date range and selected machine
        this.machineStops = stops
          .filter(stop => {
            const stopStart = new Date(stop.start_time);
            return stop.machine_name === this.selectedMachine && 
                  stopStart >= startDate && stopStart <= endDate;
          })
          .map(stop => ({
            machine_name: stop.machine_name,
            start_time: stop.start_time,
            end_time: stop.end_time,
            duration_hours: stop.duration_minutes ? stop.duration_minutes / 60 : 0
          }));
        
        this.calculatePerformanceMetrics();
        this.renderCharts();
      });
  }
  
  loadAnomalies(): void {
    // Create a request object for historical anomalies
    const anomalyRequest: HistoricalAnomalyRequest = {
      start_date: this.startDate,
      end_date: this.endDate,
      machines: [this.selectedMachine]
    };
    
    this.anomaliesSubscription = this.machineService.getHistoricalAnomalies(anomalyRequest)
      .pipe(
        catchError(err => {
          this.error = `Error loading anomalies: ${err.message}`;
          return of({});
        }),
        finalize(() => {
          if (!this.dataSubscription && !this.stopsSubscription) {
            this.isLoading = false;
          }
        })
      )
      .subscribe(anomalies => {
        this.anomalies = anomalies;
        this.calculateAnomalyMetrics();
        this.renderCharts();
      });
  }
  
  calculatePerformanceMetrics(): void {
    // Calculate uptime and downtime
    this.totalUptime = 0;
    this.totalDowntime = 0;
    
    const startDate = new Date(this.startDate);
    const endDate = new Date(this.endDate);
    const totalHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    
    // Calculate total downtime from machine stops
    this.machineStops.forEach(stop => {
      let stopEndTime = stop.end_time ? new Date(stop.end_time) : new Date();
      if (stopEndTime > endDate) {
        stopEndTime = endDate;
      }
      
      const stopStartTime = new Date(stop.start_time);
      if (stopStartTime >= startDate && stopEndTime <= endDate) {
        this.totalDowntime += stop.duration_hours || 0;
      }
    });
    
    this.totalUptime = totalHours - this.totalDowntime;
    this.efficiencyRate = (this.totalUptime / totalHours) * 100;
  }
  
  calculateAnomalyMetrics(): void {
    // Calculate total anomalies
    this.anomalyCount = 0;
    
    if (this.anomalies && this.anomalies[this.selectedMachine]) {
      const machineAnomalies = this.anomalies[this.selectedMachine];
      if ('anomalies' in machineAnomalies) {
        this.anomalyCount = machineAnomalies.anomalies.length;
      } else if (machineAnomalies.summary) {
        this.anomalyCount = machineAnomalies.summary.total_anomalies;
      }
    }
  }
  
  onMachineChange(): void {
    this.loadData();
  }
  
  onDateRangeChange(range: string): void {
    this.selectedDateRange = range;
    
    const today = new Date();
    let startDate = new Date();
    
    switch (range) {
      case '24h':
        startDate.setHours(today.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(today.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(today.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(today.getDate() - 90);
        break;
      default:
        startDate.setDate(today.getDate() - 30);
    }
    
    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = today.toISOString().split('T')[0];
    
    this.loadData();
  }
  
  onDateFilterChange(): void {
    this.loadData();
  }
  
  onMetricToggle(metric: string): void {
    const index = this.selectedMetrics.indexOf(metric);
    if (index > -1) {
      this.selectedMetrics.splice(index, 1);
    } else {
      this.selectedMetrics.push(metric);
    }
    this.renderCharts();
  }
  
  renderCharts(): void {
    // Destroy previous charts
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
    
    if (!this.machineData.length) return;
    
    this.renderTimeseriesChart();
    this.renderMetricsComparisonChart();
    this.renderAnomalyChart();
    this.renderStopsChart();
  }
  
  renderTimeseriesChart(): void {
    if (!this.timeseriesCanvas) return;
    
    const ctx = this.timeseriesCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    
    // Process data for the chart
    const labels = this.machineData.map(item => {
      const timestamp = item.Timestamp || item['timestamp'];
      return timestamp ? new Date(timestamp).toLocaleString() : '';
    });
    
    // Optimize for large datasets
    const decimationFactor = this.machineData.length > 1000 ? Math.ceil(this.machineData.length / 1000) : 1;
    const decimatedLabels = this.decimateData(labels, decimationFactor);
    
    const datasets = this.selectedMetrics.map(metric => {
      const color = this.chartColors[metric] || this.getUniqueColor(metric);
      
      // Extract data points for this metric
      const data = this.machineData.map(item => {
        const value = item[metric as keyof MachineData];
        return typeof value === 'number' ? value : null;
      });
      
      const decimatedData = this.decimateData(data, decimationFactor);
      
      return {
        label: metric,
        data: decimatedData,
        borderColor: color,
        backgroundColor: this.hexToRgba(color, 0.1),
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: decimatedData.length > 100 ? 0 : 2,
        pointHoverRadius: 4
      };
    });
    
    const options: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: false,
        axis: 'x'
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Time'
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true,
            maxTicksLimit: 20
          }
        },
        y: {
          title: {
            display: true,
            text: 'Value'
          },
          beginAtZero: false
        }
      },
      plugins: {
        title: {
          display: true,
          text: `Time Series Analysis - ${this.selectedMachine} (${this.machineData.length} data points)`
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false
        },
        legend: {
          position: 'top',
          labels: {
            boxWidth: 12,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x'
          },
          zoom: {
            wheel: {
              enabled: true
            },
            pinch: {
              enabled: true
            },
            mode: 'x'
          }
        }
      },
      animation: {
        duration: this.machineData.length > 1000 ? 0 : 1000
      }
    };
    
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: decimatedLabels,
        datasets
      },
      options: options as any
    });
    
    this.charts.push(chart);
  }
  
  renderMetricsComparisonChart(): void {
    if (!this.metricsComparisonCanvas) return;
    
    const ctx = this.metricsComparisonCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    
    // Get the latest data point
    const latestData = this.machineData[this.machineData.length - 1];
    
    const data = this.availableMetrics.map(metric => {
      const value = latestData[metric as keyof MachineData];
      return typeof value === 'number' ? value : null;
    });
    
    const backgroundColors = this.availableMetrics.map(metric => this.chartColors[metric] || this.getUniqueColor(metric));
    
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.availableMetrics,
        datasets: [{
          label: 'Current Values',
          data: data,
          backgroundColor: backgroundColors.map(color => this.hexToRgba(color, 0.7)),
          borderColor: backgroundColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Metric Comparison - ${this.selectedMachine} (Latest Measurement)`
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                return value !== null ? `Value: ${value.toFixed(2)}` : 'No data';
              }
            }
          }
        }
      }
    });
    
    this.charts.push(chart);
  }
  
  renderAnomalyChart(): void {
    if (!this.anomalyCanvas) return;
    
    const ctx = this.anomalyCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    
    // Prepare anomaly data
    let anomalyData: {date: string, count: number}[] = [];
    
    if (this.anomalies && this.anomalies[this.selectedMachine]) {
      const machineAnomalies = this.anomalies[this.selectedMachine];
      
      if ('anomalies' in machineAnomalies) {
        // Group anomalies by day
        const anomaliesByDay = new Map<string, number>();
        
       /* machineAnomalies.anomalies.forEach(anomaly => {
          const date = new Date(anomaly.timestamp).toISOString().split('T')[0];
          anomaliesByDay.set(date, (anomaliesByDay.get(date) || 0) + 1);
        });*/
        
        // Convert to array for chart
        anomalyData = Array.from(anomaliesByDay.entries()).map(([date, count]) => ({
          date,
          count
        }));
      } else if (machineAnomalies.period?.start) {
        // Use pre-aggregated data if available
        anomalyData = Object.entries(machineAnomalies.period.start).map(([date, count]) => ({
          date,
          count: Number(count)
        }));
      }
    }
    
    // Sort by date
    anomalyData.sort((a, b) => a.date.localeCompare(b.date));
    
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: anomalyData.map(item => item.date),
        datasets: [{
          label: 'Anomalies',
          data: anomalyData.map(item => item.count),
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Anomalies'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Anomaly Analysis - ${this.selectedMachine}`
          },
          tooltip: {
            callbacks: {
              title: (tooltipItems) => {
                return tooltipItems[0].label;
              },
              label: (context) => {
                const value = context.parsed.y;
                return `Anomalies: ${value}`;
              }
            }
          }
        }
      }
    });
    
    this.charts.push(chart);
  }
  
  renderStopsChart(): void {
    if (!this.stopsCanvas) return;
    
    const ctx = this.stopsCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    
    // Group stops by day
    const stopsByDay = new Map<string, number>();
    
    this.machineStops.forEach(stop => {
      const date = new Date(stop.start_time).toISOString().split('T')[0];
      stopsByDay.set(date, (stopsByDay.get(date) || 0) + (stop.duration_hours || 0));
    });
    
    // Convert to array for chart
    const stopsData = Array.from(stopsByDay.entries()).map(([date, hours]) => ({
      date,
      hours
    }));
    
    // Sort by date
    stopsData.sort((a, b) => a.date.localeCompare(b.date));
    
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: stopsData.map(item => item.date),
        datasets: [{
          label: 'Downtime Hours',
          data: stopsData.map(item => item.hours),
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Hours'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Machine Stops Analysis - ${this.selectedMachine}`
          },
          tooltip: {
            callbacks: {
              title: (tooltipItems) => {
                return tooltipItems[0].label;
              },
              label: (context) => {
                const value = context.parsed.y;
                return `Downtime: ${value.toFixed(2)} hours`;
              }
            }
          }
        }
      }
    });
    
    this.charts.push(chart);
  }
  
  refreshData(): void {
    this.loadData();
  }
  
  toggleFullscreen(element: string): void {
    if (this.fullscreenElement === element) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen(element);
    }
  }
  
  enterFullscreen(element: string): void {
    this.fullscreenElement = element;
    this.isFullscreen = true;
    
    // Add fullscreen class to the appropriate element
    document.querySelector(`.${element}`)?.classList.add('fullscreen');
    
    // Redraw charts after a short delay to adapt to the new size
    setTimeout(() => {
      this.renderCharts();
    }, 100);
  }
  
  exitFullscreen(): void {
    this.isFullscreen = false;
    
    // Remove fullscreen class from the previously fullscreen element
    if (this.fullscreenElement) {
      document.querySelector(`.${this.fullscreenElement}`)?.classList.remove('fullscreen');
    }
    
    this.fullscreenElement = null;
    
    // Redraw charts after a short delay to adapt to the new size
    setTimeout(() => {
      this.renderCharts();
    }, 100);
  }
  
  unsubscribeAll(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
      this.dataSubscription = null;
    }
    
    if (this.stopsSubscription) {
      this.stopsSubscription.unsubscribe();
      this.stopsSubscription = null;
    }
    
    if (this.anomaliesSubscription) {
      this.anomaliesSubscription.unsubscribe();
      this.anomaliesSubscription = null;
    }
  }
  
  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    // Redraw charts when window is resized
    this.renderCharts();
  }
  
  // Helper methods for colors and data processing
  getUniqueColor(text: string): string {
    // Generate a deterministic color based on text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert to HSL for better contrasts
    const h = Math.abs(hash % 360);
    const s = 65 + Math.abs((hash >> 8) % 20); // 65-85%
    const l = 45 + Math.abs((hash >> 16) % 10); // 45-55%
    
    // Convert HSL to hex
    return this.hslToHex(h, s, l);
  }
  
  hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  
  hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  
  decimateData<T>(data: T[], factor: number): T[] {
    if (factor <= 1) return data;
    
    const result: T[] = [];
    for (let i = 0; i < data.length; i += factor) {
      result.push(data[i]);
    }
    
    if (data.length > 0 && result[result.length - 1] !== data[data.length - 1]) {
      result.push(data[data.length - 1]);
    }
    
    return result;
  }
}