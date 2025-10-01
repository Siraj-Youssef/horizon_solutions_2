import React, { useState, useEffect, useRef } from 'react';

import {
LineChart,
Line,
XAxis,
YAxis,
CartesianGrid,
Tooltip,
Legend,
ResponsiveContainer,
AreaChart,
Area,
BarChart,
Bar
} from 'recharts';

import {
Activity,
Thermometer,
Wind,
Gauge,
Power,
CheckCircle,
Upload,
RefreshCw,
Settings,
FileText
} from 'lucide-react';

// Interfaces
interface SensorData {
timestamp: number;
time: string;
temperatura: number;
fluxoAr: number;
pressaoValvula: number;
comutacaoValvula: number;
status: string;
}

interface MetricCardProps {
title: string;
value: number | string;
unit: string;
icon: React.ComponentType<any>;
type: string;
trend: number;
}

const generateSampleData = (): SensorData[] => {
const baseTime = Date.now();
const data: SensorData[] = [];
for (let i = 0; i < 50; i++) {
data.push({
timestamp: baseTime - (49 - i) * 60000,
time: new Date(baseTime - (49 - i) * 60000).toLocaleTimeString('pt-BR', {
hour: '2-digit',
minute: '2-digit'
}),
temperatura: 22 + Math.sin(i * 0.2) * 8 + Math.random() * 3,
fluxoAr: 45 + Math.cos(i * 0.15) * 15 + Math.random() * 5,
pressaoValvula: 2.1 + Math.sin(i * 0.1) * 0.8 + Math.random() * 0.2,
comutacaoValvula: Math.random() > 0.7 ? 1 : 0,
status: Math.random() > 0.8 ? 'warning' : 'normal'
});
}
return data;
};

const STATES = ['Critico', 'Péssimo', 'Pequeno', 'Normal', 'Excelente'] as const;
type StateName = typeof STATES[number];

// 🚨 CORREÇÃO CRÍTICA: Tipo de retorno explícito 🚨
const SystemScreen: React.FC = (): React.JSX.Element => {
const [sensorData, setSensorData] = useState<SensorData[]>(generateSampleData());
const [jsonInput, setJsonInput] = useState('');
const [isUploading, setIsUploading] = useState(false);
const [lastUpdate, setLastUpdate] = useState(new Date());
const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

const fileInputRef = useRef<HTMLInputElement | null>(null);
const wsRef = useRef<WebSocket | null>(null);

// ---------- STYLES (mantive tema preto + scrollbar) ----------
const styles = `
:root {
--bg: #000000;
--panel: #060606;
--muted: #9aa6b2;
--accent: #14b8a6;
--card-border: rgba(255,255,255,0.06);
--text: #ffffff;
--crit: #ef4444;
--pessimo: #f97316;
--pequeno: #f59e0b;
--normal: #22c55e;
--excelente: #06b6d4;
}

* { box-sizing: border-box; }
html,body,#root { height:100%; margin:0; padding:0; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial; background: var(--bg); color: var(--text); -webkit-font-smoothing:antialiased; }
body { overflow-y: overlay; }
*::-webkit-scrollbar { width: 12px; height: 12px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: rgba(20,184,166,0.92); border-radius: 10px; border: 3px solid transparent; background-clip: padding-box; }
*::-webkit-scrollbar-thumb:hover { background: rgba(20,184,166,1.0); }
* { scrollbar-width: thin; scrollbar-color: rgba(20,184,166,0.92) transparent; }
.page { min-height: 100vh; background: var(--bg); }
.header { background: var(--bg); position: sticky; top: 0; z-index: 60; box-shadow: 0 6px 20px rgba(0,0,0,0.6); border-bottom: 1px solid rgba(255,255,255,0.02); }
.header-inner { max-width: 1200px; margin: 0 auto; padding: 18px 20px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
.brand { display:flex; gap:12px; align-items:center; }
.brand h1 { margin:0; font-size: 1.45rem; color: var(--text); }
.brand p { margin:0; color: var(--muted); font-size: 0.9rem; }
.container { max-width: 1200px; margin: 18px auto; padding: 0 20px 40px; }
.panel-highlight { background: linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.005)); border: 1px solid var(--card-border); border-radius: 14px; padding: 18px; box-shadow: 0 12px 40px rgba(0,0,0,0.6); margin-bottom: 20px; }
.panel-title { color: var(--muted); font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:10px; }
.metrics-grid { display:grid; gap:16px; grid-template-columns: 1fr; }
@media(min-width:720px){ .metrics-grid { grid-template-columns: repeat(2, 1fr); } }
@media(min-width:1100px){ .metrics-grid { grid-template-columns: repeat(4, 1fr); } }
.card { background: transparent; border-radius:10px; padding:14px; }
.metric-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.metric-left { display:flex; align-items:center; gap:10px; }
.metric-title { margin:0; color:var(--muted); font-weight:600; }
.metric-value { font-size:1.4rem; font-weight:700; display:flex; align-items:baseline; gap:8px; color:var(--text); }
.metric-unit { color:var(--muted); font-size:0.9rem; }
.progress-outer { width:100%; background: rgba(255,255,255,0.02); height:8px; border-radius:999px; margin-top:8px; }
.progress-inner { height:100%; border-radius:999px; transition: width 0.5s ease; }
.panel-states { margin-top: 14px; background: linear-gradient(180deg, rgba(255,255,255,0.008), rgba(255,255,255,0.003)); border: 1px solid var(--card-border); border-radius: 12px; padding: 14px; display:flex; align-items:center; gap:16px; }
.state-grid { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.state-badge { min-width:120px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:10px 12px; border-radius:10px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.02); text-align:center; }
.state-label { font-weight:700; font-size:0.95rem; }
.state-count { font-size:1.2rem; font-weight:800; }
.state-desc { font-size:0.78rem; color:var(--muted); }
.state-critico { border-left: 4px solid var(--crit); }
.state-pessimo { border-left: 4px solid var(--pessimo); }
.state-pequeno { border-left: 4px solid var(--pequeno); }
.state-normal { border-left: 4px solid var(--normal); }
.state-excelente { border-left: 4px solid var(--excelente); }
.upload-section { margin: 18px 0; }
.file-controls { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.file-info { color: var(--muted); font-size:0.9rem; }
textarea.json-input { width:100%; min-height:140px; background:transparent; border:1px solid rgba(255,255,255,0.04); color:inherit; padding:10px; border-radius:8px; resize:vertical; outline:none; }
.btn { display:inline-flex; gap:8px; align-items:center; background:var(--accent); color:#042022; padding:8px 12px; border-radius:8px; border:none; cursor:pointer; font-weight:600; }
.btn:disabled { opacity:0.5; cursor:not-allowed; }
.panel-charts { background: linear-gradient(180deg, rgba(255,255,255,0.008), rgba(255,255,255,0.004)); border: 1px solid var(--card-border); border-radius: 14px; padding: 18px; box-shadow: 0 12px 40px rgba(0,0,0,0.55); margin-bottom: 40px; }
.charts { display:grid; gap:20px; grid-template-columns:1fr; }
@media(min-width:1000px){ .charts { grid-template-columns: repeat(2, 1fr); } }
.chart-panel { padding:14px; border-radius:10px; background: transparent; border: 1px dashed rgba(255,255,255,0.02); }
.chart-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.chart-box { width:100%; height:300px; }
.small-muted { color:var(--muted); font-size:0.9rem; }
.icon-wrap { display:inline-flex; padding:8px; border-radius:8px; background: rgba(20,184,166,0.06); }
@keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
.connection-status {
display: flex;
align-items: center;
gap: 8px;
padding: 4px 8px;
border-radius: 6px;
font-size: 0.85rem;
}
.status-connecting { background: rgba(251, 191, 36, 0.1); color: #f59e0b; }
.status-connected { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.status-disconnected { background: rgba(107, 114, 128, 0.1); color: #6b7280; }
.status-error { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
`;

// 🔧 ÚNICA CORREÇÃO: WebSocket URL e mapeamento de dados
useEffect(() => {
const connectWebSocket = () => {
// 🚨 URL CORRIGIDA: /ws/dados (não /wsdados) 🚨
const wsUrl = 'ws://10.20.53.19:1880/ws/dados';
setConnectionStatus('connecting');

const ws = new WebSocket(wsUrl);
wsRef.current = ws;

ws.onopen = () => {
setConnectionStatus('connected');
console.log('✅ Conectado ao Node-RED em 10.20.53.19:1880/ws/dados');
};

ws.onmessage = (event) => {
try {
const data = JSON.parse(event.data);
console.log('📦 Dados recebidos:', data);
// Mapear dados do Node-RED para o formato SensorData
const novoSensor: SensorData = {
timestamp: data.timestamp ?? Date.now(),
time: new Date(data.timestamp ?? Date.now()).toLocaleTimeString('pt-BR', {
hour: '2-digit',
minute: '2-digit'
}),
// Mapear campos do Node-RED baseado no fluxo JSON
temperatura: Number(data.temperatura) || 22,
fluxoAr: Number(data.pressaoEntrada) || 50, // Usando pressão de entrada como fluxo
pressaoValvula: Number(data.pressaoSaida1) || 2.0, // Usando pressão de saída 1
comutacaoValvula: data.bobinaD === 'Direita' ? 1 : data.bobinaE === 'Esquerda' ? 1 : 0,
status: data.situacao === 'Avançado' ? 'normal' : data.situacao === 'Retornado' ? 'warning' : 'normal',
};

setSensorData(prev => {
const arr = [...prev, novoSensor];
// Mantém até 50 registros
if (arr.length > 50) arr.shift();
return arr;
});
setLastUpdate(new Date());
} catch (err) {
console.error('❌ Erro ao processar dados do WebSocket:', err);
}
};

ws.onerror = (error) => {
console.error('❌ Erro WebSocket:', error);
setConnectionStatus('error');
};

ws.onclose = () => {
setConnectionStatus('disconnected');
console.log('🔌 Desconectado do Node-RED. Tentando reconectar em 3 segundos...');
// Tentar reconectar após 3 segundos
setTimeout(connectWebSocket, 3000);
};
};

connectWebSocket();

return () => {
if (wsRef.current) {
wsRef.current.close();
}
};
}, []);

// ---------- helpers for processing JSON (kept original) ----------
const normalizeParsedArray = (parsedData: any[]): SensorData[] => {
return parsedData.map((item: any, index: number) => {
const timestampValue = Number(item.timestamp ?? Date.now() - (parsedData.length - index) * 60000);
const temperaturaValue = Number(item.temperatura ?? item.temperature ?? 20);
const fluxoArValue = Number(item.fluxoAr ?? item.airFlow ?? item.flow ?? 50);
const pressaoValvulaValue = Number(item.pressaoValvula ?? item.pressure ?? item.valve_pressure ?? 2.0);
const comutacaoValvulaValue = Number(item.comutacaoValvula ?? item.valve_state ?? item.switching ?? 0);

const ts = Number(isNaN(timestampValue) ? Date.now() - (parsedData.length - index) * 60000 : timestampValue);

return {
timestamp: ts,
time: new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
temperatura: isNaN(temperaturaValue) ? 20 : temperaturaValue,
fluxoAr: isNaN(fluxoArValue) ? 50 : fluxoArValue,
pressaoValvula: isNaN(pressaoValvulaValue) ? 2.0 : pressaoValvulaValue,
comutacaoValvula: comutacaoValvulaValue === 1 ? 1 : 0,
status: item.status ?? 'normal'
} as SensorData;
});
};

// ---------- existing textarea upload logic (kept) ----------
const handleJsonUpload = async (): Promise<void> => {
if (!jsonInput.trim()) return;

setIsUploading(true);
try {
const parsedData = JSON.parse(jsonInput);
if (Array.isArray(parsedData)) {
const processedData = normalizeParsedArray(parsedData);
setSensorData(processedData);
setJsonInput('');
setSelectedFileName(null);
alert('Dados carregados com sucesso (textarea)!');
} else {
alert('JSON precisa ser um array de objetos.');
}
} catch (error: unknown) {
alert('Erro ao processar JSON: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
} finally {
setIsUploading(false);
}
};

// ---------- NEW: read file helper ----------
const readFileAsText = (file: File): Promise<string> => {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onerror = () => {
reader.abort();
reject(new Error('Erro lendo o arquivo'));
};
reader.onload = () => {
resolve(String(reader.result ?? ''));
};
reader.readAsText(file, 'utf-8');
});
};

// ---------- NEW: handle file selection via native file picker ----------
const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement> | FileList | null) => {
const file = e instanceof FileList ? e[0] : e && (e.target as HTMLInputElement).files ? (e.target as HTMLInputElement).files![0] : null;
if (!file) return;

setSelectedFileName(file.name);
setIsUploading(true);

try {
const text = await readFileAsText(file);
const parsed = JSON.parse(text);

if (!Array.isArray(parsed)) {
alert('Arquivo JSON precisa ser um array de objetos.');
setIsUploading(false);
return;
}

const processed = normalizeParsedArray(parsed);
setSensorData(processed);
setLastUpdate(new Date());
alert(`Arquivo "${file.name}" carregado com sucesso!`);
} catch (err: unknown) {
alert('Erro ao processar arquivo: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
} finally {
setIsUploading(false);
// reset native input so selecting same file again still triggers change
if (fileInputRef.current) fileInputRef.current.value = '';
}
};

// convenience: trigger native file dialog
const openFileDialog = () => {
fileInputRef.current?.click();
};

// ---------- state evaluation logic (keeps previous behaviour) ----------
const idealValues: Record<string, number> = {
temperatura: 22,
fluxoAr: 50,
pressaoValvula: 2.0
};

const getStateForMetric = (value: number, type: 'temperatura' | 'fluxoAr' | 'pressaoValvula'): StateName => {
const ideal = idealValues[type];
const diff = Math.abs(value - ideal);

if (diff <= 1) return 'Excelente';
if (diff <= 4) return 'Normal';
if (diff <= 8) return 'Pequeno';
if (diff <= 12) return 'Péssimo';
return 'Critico';
};

const currentData: Partial<SensorData> = sensorData[sensorData.length - 1] || {};

const temp = typeof currentData.temperatura === 'number' ? currentData.temperatura : NaN;
const fluxo = typeof currentData.fluxoAr === 'number' ? currentData.fluxoAr : NaN;
const press = typeof currentData.pressaoValvula === 'number' ? currentData.pressaoValvula : NaN;

const statesMap: Record<string, StateName | 'unknown'> = {
'Temperatura': isNaN(temp) ? 'unknown' : getStateForMetric(temp, 'temperatura'),
'Fluxo de Ar': isNaN(fluxo) ? 'unknown' : getStateForMetric(fluxo, 'fluxoAr'),
'Pressão da Válvula': isNaN(press) ? 'unknown' : getStateForMetric(press, 'pressaoValvula')
};

const countsByState: Record<StateName, number> = {
'Critico': 0,
'Péssimo': 0,
'Pequeno': 0,
'Normal': 0,
'Excelente': 0
};

Object.values(statesMap).forEach(s => { if (s !== 'unknown') countsByState[s as StateName] += 1; });

// ---------- MetricCard (kept) ----------
const getStatusColor = (value: number, type: string): string => {
switch (type) {
case 'temperatura':
return value > 35 ? '#ef4444' : value > 30 ? '#f59e0b' : '#22c55e';
case 'fluxoAr':
return value < 20 ? '#ef4444' : value < 30 ? '#f59e0b' : '#22c55e';
case 'pressaoValvula':
return value > 3 ? '#ef4444' : value > 2.5 ? '#f59e0b' : '#22c55e';
default:
return '#22c55e';
}
};

const computeFillPercent = (value: number | string, type: string) => {
if (typeof value !== 'number' || isNaN(value)) return '0%';
const max = type === 'temperatura' ? 50 : type === 'fluxoAr' ? 100 : 5;
return `${Math.min(100, (value / max) * 100)}%`;
};

const MetricCard: React.FC<MetricCardProps> = ({ title, value, unit, icon: Icon, type, trend }): React.JSX.Element => {
const numericValue = typeof value === 'number' ? value : Number(value) || 0;
const color = getStatusColor(numericValue, type);

return (
<div className="card" style={{ background: 'transparent' }}>
<div className="metric-top">
<div className="metric-left">
<div className="icon-wrap" style={{ padding: 8, borderRadius: 8, background: 'rgba(20,184,166,0.06)' }}>
<Icon size={16} color={color} />
</div>
<div className="metric-title">{title}</div>
</div>
<div style={{ color: '#9aa6b2', fontSize: 16 }}>
{trend > 0 ? '↗' : trend < 0 ? '↘' : '→'}
</div>
</div>
<div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
<div className="metric-value" style={{ color }}>
{typeof value === 'number' ? value.toFixed(1) : String(value)}
</div>
<div className="metric-unit">{unit}</div>
</div>
<div className="progress-outer">
<div className="progress-inner" style={{ width: computeFillPercent(value, type), backgroundColor: color }} />
</div>
</div>
);
};

const CustomTooltip = ({ active, payload, label }: any): React.JSX.Element | null => {
if (active && payload && payload.length) {
return (
<div style={{ background: 'rgba(6,8,12,0.95)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}>
<div style={{ fontWeight: 700, marginBottom: 6 }}>{`Horário: ${label}`}</div>
{payload.map((entry: any, i: number) => {
const value = entry?.value;
const formatted = typeof value === 'number' && !isNaN(value) ? value.toFixed(2) : String(value ?? '-');
const unit = entry?.dataKey === 'temperatura' ? '°C' : entry?.dataKey === 'fluxoAr' ? ' L/min' : entry?.dataKey === 'pressaoValvula' ? ' bar' : '';

return (
<div key={i} style={{ color: entry?.color ?? '#fff', fontSize: 13 }}>
{`${entry?.name ?? entry?.dataKey ?? 'valor'}: ${formatted}${unit}`}
</div>
);
})}
</div>
);
}
return null;
};

const getConnectionStatusDisplay = () => {
const statusMap = {
connecting: { text: 'Conectando Node-RED...', class: 'status-connecting', color: '#f59e0b' },
connected: { text: 'Node-RED Conectado (10.20.53.19)', class: 'status-connected', color: '#22c55e' },
disconnected: { text: 'Desconectado', class: 'status-disconnected', color: '#6b7280' },
error: { text: 'Erro de Conexão', class: 'status-error', color: '#ef4444' }
};
return statusMap[connectionStatus];
};

const connectionStatusDisplay = getConnectionStatusDisplay();

return (
<div className="page">
<style>{styles}</style>
<div className="header">
<div className="header-inner">
<div className="brand">
<div style={{ display: 'flex', alignItems: 'center', padding: 8, borderRadius: 10, background: 'rgba(20,184,166,0.06)' }}>
<Activity size={24} color="#14b8a6" />
</div>
<div>
<h1>Sistema de Monitoramento</h1>
<p>Dashboard em Tempo Real</p>
</div>
</div>
<div className={`connection-status ${connectionStatusDisplay.class}`}>
<div style={{ width: 8, height: 8, borderRadius: '50%', background: connectionStatusDisplay.color }} />
<span>{connectionStatusDisplay.text}</span>
</div>
</div>
</div>

<div className="container">
{/* Metrics */}
<div className="panel-highlight">
<div className="panel-title">
<Activity size={20} />
<div>Visão Geral</div>
</div>

<div className="metrics-grid">
<MetricCard 
title="Temperatura" 
value={currentData.temperatura ?? 0} 
unit="°C" 
icon={Thermometer} 
type="temperatura" 
trend={0} 
/>
<MetricCard 
title="Fluxo de Ar" 
value={currentData.fluxoAr ?? 0} 
unit="L/min" 
icon={Wind} 
type="fluxoAr" 
trend={1} 
/>
<MetricCard 
title="Pressão da Válvula" 
value={currentData.pressaoValvula ?? 0} 
unit="bar" 
icon={Gauge} 
type="pressaoValvula" 
trend={-1} 
/>
<MetricCard 
title="Estado da Válvula" 
value={currentData.comutacaoValvula === 1 ? 'ABERTA' : 'FECHADA'} 
unit="" 
icon={currentData.comutacaoValvula === 1 ? CheckCircle : Power} 
type="status" 
trend={0} 
/>
</div>

{/* States panel */}
<div className="panel-states">
<div style={{ minWidth: 200 }}>
<div style={{ fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Estados dos Sensores</div>
<div style={{ fontSize: 13, color: 'var(--muted)' }}>Resumo do estado atual dos sensores principais</div>
</div>

<div className="state-grid">
<div className="state-badge state-critico">
<div className="state-label">Crítico</div>
<div className="state-count">{countsByState.Critico}</div>
<div className="state-desc">Desvio muito alto</div>
</div>
<div className="state-badge state-pessimo">
<div className="state-label">Péssimo</div>
<div className="state-count">{countsByState['Péssimo']}</div>
<div className="state-desc">Alerta alto</div>
</div>
<div className="state-badge state-pequeno">
<div className="state-label">Pequeno</div>
<div className="state-count">{countsByState['Pequeno']}</div>
<div className="state-desc">Desvio moderado</div>
</div>
<div className="state-badge state-normal">
<div className="state-label">Normal</div>
<div className="state-count">{countsByState['Normal']}</div>
<div className="state-desc">Dentro do esperado</div>
</div>
<div className="state-badge state-excelente">
<div className="state-label">Excelente</div>
<div className="state-count">{countsByState['Excelente']}</div>
<div className="state-desc">Ótimo</div>
</div>
</div>

<div style={{ marginLeft: 'auto', minWidth: 200 }}>
<div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>Detalhes</div>
<div style={{ fontSize: 13 }}>
<div><strong>Temperatura:</strong> <span style={{ color: '#fff' }}>{statesMap['Temperatura']}</span></div>
<div><strong>Fluxo de Ar:</strong> <span style={{ color: '#fff' }}>{statesMap['Fluxo de Ar']}</span></div>
<div><strong>Pressão:</strong> <span style={{ color: '#fff' }}>{statesMap['Pressão da Válvula']}</span></div>
</div>
</div>
</div>
</div>

{/* Upload + File selector */}
<div className="upload-section card">
<div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
<Upload size={16} color="#14b8a6" />
<h3 style={{ margin: 0 }}>Carregar Dados JSON</h3>
</div>

<div className="file-controls" style={{ marginBottom: 12 }}>
{/* Hidden native file input */}
<input
ref={fileInputRef}
type="file"
accept=".json"
style={{ display: 'none' }}
onChange={(e) => handleFileSelected(e)}
/>

<button onClick={openFileDialog} className="btn" style={{ background: '#0ea5a1' }}>
<Upload size={14} />
Selecionar arquivo JSON
</button>

<button 
onClick={handleJsonUpload}
disabled={isUploading || !jsonInput.trim()}
className="btn"
style={{ background: '#0ea5a1' }}
>
{isUploading ? <RefreshCw size={14} /> : <Upload size={14} />}
<span>{isUploading ? 'Carregando...' : 'Carregar (textarea)'}</span>
</button>

<button 
onClick={() => { setSelectedFileName(null); setJsonInput(''); }}
className="btn"
style={{ background: '#374151', color: '#fff' }}
type="button"
>
<RefreshCw size={14} />
Limpar
</button>
</div>

<div className="file-info">
{selectedFileName ? `Arquivo selecionado: ${selectedFileName}` : 'Nenhum arquivo selecionado'}
<br />ou cole JSON no campo abaixo e clique em "Carregar (textarea)"
</div>

<textarea 
value={jsonInput}
onChange={(e) => setJsonInput(e.target.value)}
placeholder='Exemplo: [{"timestamp": 1234567890, "temperatura": 25.5, "fluxoAr": 48.2, "pressaoValvula": 2.1, "comutacaoValvula": 1}]'
className="json-input"
/>
</div>

{/* Charts Panel */}
<div className="panel-charts">
<div className="panel-title">
<Activity size={20} />
<div>Gráficos</div>
</div>

<div className="charts">
{/* Temperature */}
<div className="chart-panel">
<div className="chart-header">
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
<Thermometer size={18} color="#ef4444" />
<strong>Temperatura</strong>
</div>
<div className="small-muted">°C</div>
</div>
<div className="chart-box">
<ResponsiveContainer width="100%" height="100%">
<AreaChart data={sensorData}>
<defs>
<linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
<stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
<stop offset="95%" stopColor="#ef4444" stopOpacity={0.06} />
</linearGradient>
</defs>
<CartesianGrid strokeDasharray="3 3" stroke="#222" />
<XAxis dataKey="time" stroke="#9aa6b2" fontSize={12} />
<YAxis stroke="#9aa6b2" fontSize={12} />
<Tooltip content={<CustomTooltip />} />
<Area type="monotone" dataKey="temperatura" stroke="#ef4444" strokeWidth={2} fill="url(#tempGradient)" />
</AreaChart>
</ResponsiveContainer>
</div>
</div>

{/* Air Flow */}
<div className="chart-panel">
<div className="chart-header">
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
<Wind size={18} color="#3b82f6" />
<strong>Fluxo de Ar</strong>
</div>
<div className="small-muted">L/min</div>
</div>
<div className="chart-box">
<ResponsiveContainer width="100%" height="100%">
<AreaChart data={sensorData}>
<defs>
<linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
<stop offset="95%" stopColor="#3b82f6" stopOpacity={0.06} />
</linearGradient>
</defs>
<CartesianGrid strokeDasharray="3 3" stroke="#222" />
<XAxis dataKey="time" stroke="#9aa6b2" fontSize={12} />
<YAxis stroke="#9aa6b2" fontSize={12} />
<Tooltip content={<CustomTooltip />} />
<Area type="monotone" dataKey="fluxoAr" stroke="#3b82f6" strokeWidth={2} fill="url(#flowGradient)" />
</AreaChart>
</ResponsiveContainer>
</div>
</div>

{/* Valve Pressure */}
<div className="chart-panel">
<div className="chart-header">
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
<Gauge size={18} color="#eab308" />
<strong>Pressão da Válvula</strong>
</div>
<div className="small-muted">bar</div>
</div>
<div className="chart-box">
<ResponsiveContainer width="100%" height="100%">
<LineChart data={sensorData}>
<CartesianGrid strokeDasharray="3 3" stroke="#222" />
<XAxis dataKey="time" stroke="#9aa6b2" fontSize={12} />
<YAxis stroke="#9aa6b2" fontSize={12} />
<Tooltip content={<CustomTooltip />} />
<Line type="monotone" dataKey="pressaoValvula" stroke="#eab308" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
</LineChart>
</ResponsiveContainer>
</div>
</div>

{/* Valve Switching */}
<div className="chart-panel">
<div className="chart-header">
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
<Power size={18} color="#14b8a6" />
<strong>Comutação da Válvula</strong>
</div>
<div className="small-muted">Estado</div>
</div>
<div className="chart-box">
<ResponsiveContainer width="100%" height="100%">
<BarChart data={sensorData.slice(-20)}>
<CartesianGrid strokeDasharray="3 3" stroke="#222" />
<XAxis dataKey="time" stroke="#9aa6b2" fontSize={12} />
<YAxis domain={[0, 1]} stroke="#9aa6b2" fontSize={12} />
<Tooltip content={({ active, payload, label }: any): React.JSX.Element | null => {
if (active && payload && payload.length) {
return (
<div style={{ background: 'rgba(6,8,12,0.95)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}>
<div style={{ fontWeight: 700, marginBottom: 6 }}>{`Horário: ${label}`}</div>
<div style={{ color: 'var(--accent)' }}>
Estado: {payload[0].value === 1 ? 'ABERTA' : 'FECHADA'}
</div>
</div>
);
}
return null;
}} />
<Bar dataKey="comutacaoValvula" fill="#14b8a6" radius={[4, 4, 0, 0]} />
</BarChart>
</ResponsiveContainer>
</div>
</div>
</div>
</div>
</div>
</div>
);
};

export default SystemScreen;
