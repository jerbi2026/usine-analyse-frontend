import { Component, OnInit, ViewChild, ElementRef, OnDestroy, HostListener } from '@angular/core';
import { MachineService } from '../services/machine.service';
import { MachineData } from '../models/machine.model';
import { Chart, registerables, ChartOptions } from 'chart.js';
import { catchError, finalize } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';
import zoomPlugin from 'chartjs-plugin-zoom';
Chart.register(...registerables, zoomPlugin);

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  machineData: MachineData[] = [];
  charts: Chart[] = [];
  isLoading = false;
  error = '';
  selectedDateRange: string = '24h';
  selectedMetrics: string[] = ['G19', 'G26', 'MISFAT_3_G10f', 'MISFAT_3_G33_'];
  availableMetrics: string[] = [
    'G19', 'G26', 'MISFAT_3_D02_01_M43', 'MISFAT_3_D18f', 
    'MISFAT_3_G10f', 'MISFAT_3_G33_', 'MISFAT_3_G39f', 
    'MISFAT_3_H46f', 'MISFAT_3_H53', 'MISFAT_3_N11'
  ];
  isFullscreen: boolean = false;
  fullscreenElement: string | null = null;
  dataSubscription: Subscription | null = null;
  chartColors: {[key: string]: string} = {};
  
  @ViewChild('timeseriesCanvas') timeseriesCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('comparisonCanvas') comparisonCanvas!: ElementRef<HTMLCanvasElement>;
  
  constructor(private machineService: MachineService) {}

  ngOnInit(): void {
    // Pré-générer des couleurs cohérentes pour chaque métrique
    this.availableMetrics.forEach(metric => {
      this.chartColors[metric] = this.getUniqueColor(metric);
    });
    
    this.loadData();
    
    // Mettre en place un rafraîchissement périodique (toutes les 5 minutes)
    this.setupAutoRefresh();
  }
  
  ngOnDestroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  setupAutoRefresh(): void {
    // Rafraîchir les données toutes les 5 minutes
    const refreshInterval = 5 * 60 * 1000; // 5 minutes en millisecondes
    setInterval(() => {
      if (!this.isLoading) {
        this.loadData();
      }
    }, refreshInterval);
  }

  loadData(): void {
    this.isLoading = true;
    this.error = '';
    
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
    
    this.dataSubscription = this.machineService.getMachineData()
      .pipe(
        catchError(err => {
          this.error = 'Erreur lors du chargement des données: ' + err.message;
          return of([]);
        }),
        finalize(() => this.isLoading = false)
      )
      .subscribe(data => {
        this.machineData = this.filterDataByDateRange(data);
        this.renderCharts();
      });
  }

  filterDataByDateRange(data: MachineData[]): MachineData[] {
    if (!data.length) return [];
    
    const now = new Date();
    let cutoffDate = new Date();
    
    switch (this.selectedDateRange) {
      case '24h':
        cutoffDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      default:
        cutoffDate.setHours(now.getHours() - 24);
    }
    
    return data.filter(item => new Date(item.Timestamp) >= cutoffDate);
  }

  renderCharts(): void {
    // Destroy previous charts
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
    
    if (!this.machineData.length) return;
    
    this.renderTimeseriesChart();
    this.renderComparisonChart();
  }

  renderTimeseriesChart(): void {
    if (!this.timeseriesCanvas) return;
    
    const ctx = this.timeseriesCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    
    // Process data for the chart
    const labels = this.machineData.map(item => new Date(item.Timestamp).toLocaleString());
    
    // Optimiser pour les grands volumes de données
    const decimationFactor = this.machineData.length > 1000 ? Math.ceil(this.machineData.length / 1000) : 1;
    const decimatedLabels = this.decimateData(labels, decimationFactor);
    
    const datasets = this.selectedMetrics.map(metric => {
      const color = this.chartColors[metric] || this.getUniqueColor(metric);
      const data = this.machineData.map(item => item[metric as keyof MachineData] as number);
      const decimatedData = this.decimateData(data, decimationFactor);
      
      return {
        label: metric,
        data: decimatedData,
        borderColor: color,
        backgroundColor: this.hexToRgba(color, 0.1),
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: decimatedData.length > 100 ? 0 : 2, // Masquer les points pour améliorer les performances
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
            text: 'Temps'
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
            text: 'Valeur'
          },
          beginAtZero: false
        }
      },
      plugins: {
        title: {
          display: true,
          text: `Évolution temporelle des métriques (${this.machineData.length} points de données)`
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          callbacks: {
            title: (tooltipItems) => {
              return tooltipItems[0].label;
            }
          }
        },
        legend: {
          position: 'top',
          labels: {
            boxWidth: 12,
            usePointStyle: true,
            pointStyle: 'circle'
          },
          onClick: (e, legendItem, legend) => {
            const index = legendItem.datasetIndex;
            if (index !== undefined) {
              const ci = legend.chart;
              if (ci.isDatasetVisible(index)) {
                ci.hide(index);
                legendItem.hidden = true;
              } else {
                ci.show(index);
                legendItem.hidden = false;
              }
              ci.update();
            }
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
        duration: this.machineData.length > 1000 ? 0 : 1000 // Désactiver l'animation pour les grands ensembles de données
      }
    };
    
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: decimatedLabels,
        datasets
      },
      options: options as any // Cast nécessaire car zoom n'est pas dans les types par défaut
    });
    
    this.charts.push(chart);
  }

  renderComparisonChart(): void {
    if (!this.comparisonCanvas) return;
    
    const ctx = this.comparisonCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    
    // Get the latest data point
    const latestData = this.machineData[this.machineData.length - 1];
    
    const data = this.availableMetrics.map(metric => latestData[metric as keyof MachineData] as number);
    const backgroundColors = this.availableMetrics.map(metric => this.chartColors[metric] || this.getUniqueColor(metric));
    
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.availableMetrics,
        datasets: [{
          label: 'Valeurs actuelles',
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
            text: 'Comparaison des métriques (dernière mesure)'
          },
          tooltip: {
            callbacks: {
              title: (tooltipItems) => {
                return tooltipItems[0].label;
              },
              label: (context) => {
                const value = context.parsed.y;
                return `Valeur: ${value.toFixed(2)}`;
              }
            }
          }
        }
      }
    });
    
    this.charts.push(chart);
  }

  onDateRangeChange(range: string): void {
    this.selectedDateRange = range;
    this.loadData(); // Recharger les données avec le nouveau filtre
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

  // Fonction pour générer des couleurs cohérentes basées sur le nom de la métrique
  getUniqueColor(text: string): string {
    // Générer une couleur déterministe basée sur le texte
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convertir en couleur HSL pour de meilleurs contrastes
    const h = Math.abs(hash % 360);
    const s = 65 + Math.abs((hash >> 8) % 20); // 65-85%
    const l = 45 + Math.abs((hash >> 16) % 10); // 45-55%
    
    // Convertir HSL en hex
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

  // Fonction pour décimer les données (réduire le nombre de points)
  decimateData<T>(data: T[], factor: number): T[] {
    if (factor <= 1) return data;
    
    const result: T[] = [];
    for (let i = 0; i < data.length; i += factor) {
      result.push(data[i]);
    }
    
    // Toujours inclure le dernier point pour maintenir la continuité visuelle
    if (data.length > 0 && result[result.length - 1] !== data[data.length - 1]) {
      result.push(data[data.length - 1]);
    }
    
    return result;
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
    
    // Ajouter la classe fullscreen à l'élément approprié
    document.querySelector(`.${element}`)?.classList.add('fullscreen');
    
    // Redessiner le graphique après un court délai pour s'adapter à la nouvelle taille
    setTimeout(() => {
      this.renderCharts();
    }, 100);
  }

  exitFullscreen(): void {
    this.isFullscreen = false;
    
    // Supprimer la classe fullscreen de l'élément précédemment en plein écran
    if (this.fullscreenElement) {
      document.querySelector(`.${this.fullscreenElement}`)?.classList.remove('fullscreen');
    }
    
    this.fullscreenElement = null;
    
    // Redessiner le graphique après un court délai pour s'adapter à la nouvelle taille
    setTimeout(() => {
      this.renderCharts();
    }, 100);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    // Redessiner les graphiques lors du redimensionnement de la fenêtre
    this.renderCharts();
  }
}