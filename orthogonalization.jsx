import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';

// Utility functions
const randn = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
const variance = arr => {
  const m = mean(arr);
  return arr.reduce((acc, x) => acc + (x - m) ** 2, 0) / (arr.length - 1);
};
const cov = (a, b) => {
  const ma = mean(a), mb = mean(b);
  return a.reduce((acc, x, i) => acc + (x - ma) * (b[i] - mb), 0) / (a.length - 1);
};
const percentile = (arr, p) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
};

// DFT magnitude spectrum
const dft = (signal, fs) => {
  const N = signal.length;
  const halfN = Math.floor(N / 2);
  const spectrum = [];
  
  for (let k = 0; k < halfN; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += signal[n] * Math.cos(angle);
      im -= signal[n] * Math.sin(angle);
    }
    re /= N;
    im /= N;
    spectrum.push({
      freq: (k * fs) / N,
      mag: Math.sqrt(re * re + im * im)
    });
  }
  return spectrum;
};

// Generate radio signals
const generateRadioSignals = (rho, noise, f1, f2, N, fs, seed) => {
  // Seeded random
  const seededRandom = (s) => {
    const x = Math.sin(s++) * 10000;
    return x - Math.floor(x);
  };
  
  const seededNoise = (s) => (seededRandom(s) - 0.5) * 2 * noise;
  
  const t = Array.from({ length: N }, (_, i) => i / fs);
  
  // S1(t) = sin(2πf₁t) · (1 + 0.3·sin(2π·0.5·t)) + ε₁(t)
  const S1 = t.map((ti, i) => 
    Math.sin(2 * Math.PI * f1 * ti) * (1 + 0.3 * Math.sin(2 * Math.PI * 0.5 * ti)) 
    + seededNoise(seed + i)
  );
  
  // Z(t) = sin(2πf₂t + π/4) · (1 + 0.4·cos(2π·0.7·t)) + ε₂(t)
  const Z = t.map((ti, i) => 
    Math.sin(2 * Math.PI * f2 * ti + Math.PI / 4) * (1 + 0.4 * Math.cos(2 * Math.PI * 0.7 * ti))
    + seededNoise(seed + N + i)
  );
  
  // S2(t) = ρ·S1(t) + √(1-ρ²)·Z(t)
  const sqrtOneMinusRhoSq = Math.sqrt(1 - rho * rho);
  const S2 = S1.map((s1, i) => rho * s1 + sqrtOneMinusRhoSq * Z[i]);
  
  // Orthogonalization: β = cov(S1,S2)/var(S1), S2_orth = S2 - β·S1
  const beta = cov(S1, S2) / variance(S1);
  const betaS1 = S1.map(x => beta * x);
  const S2_orth = S2.map((s2, i) => s2 - betaS1[i]);
  
  // Verification
  const actualCov = cov(S1, S2_orth);
  const explainedVar = rho * rho;
  const uniqueVar = 1 - rho * rho;
  
  return { t, S1, S2, Z, betaS1, S2_orth, beta, actualCov, explainedVar, uniqueVar };
};

// Seeded PRNG (mulberry32)
const mulberry32 = (seed) => {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};

// Generate finance simulation
const generateFinancePaths = (rho, muF, muAlpha, sigmaF, sigmaAlpha, M, T, seed) => {
  const beta = rho;
  const dailyMuF = muF / 252;
  const dailyMuAlpha = muAlpha / 252;
  const dailySigmaF = sigmaF / Math.sqrt(252);
  const dailySigmaAlpha = sigmaAlpha / Math.sqrt(252);
  
  const factorPaths = [];
  const orthPaths = [];
  const rawPaths = [];
  
  const rand = mulberry32(seed);
  const seededRandn = () => {
    const u1 = rand();
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  };
  
  for (let m = 0; m < M; m++) {
    const factorCum = [0];
    const orthCum = [0];
    const rawCum = [0];
    
    for (let t = 1; t <= T; t++) {
      const rF = dailyMuF + dailySigmaF * seededRandn();
      const rOrth = dailyMuAlpha + dailySigmaAlpha * seededRandn();
      const rRaw = beta * rF + rOrth;
      
      factorCum.push(factorCum[t - 1] + rF);
      orthCum.push(orthCum[t - 1] + rOrth);
      rawCum.push(rawCum[t - 1] + rRaw);
    }
    
    factorPaths.push(factorCum);
    orthPaths.push(orthCum);
    rawPaths.push(rawCum);
  }
  
  // Compute statistics at each timestep
  const stats = [];
  for (let t = 0; t <= T; t++) {
    const factorVals = factorPaths.map(p => p[t]);
    const orthVals = orthPaths.map(p => p[t]);
    const rawVals = rawPaths.map(p => p[t]);
    
    stats.push({
      day: t,
      factorMean: mean(factorVals),
      factorP5: percentile(factorVals, 5),
      factorP95: percentile(factorVals, 95),
      orthMean: mean(orthVals),
      orthP5: percentile(orthVals, 5),
      orthP95: percentile(orthVals, 95),
      rawMean: mean(rawVals),
      rawP5: percentile(rawVals, 5),
      rawP95: percentile(rawVals, 95),
      factorSingle: factorPaths[0][t],
      orthSingle: orthPaths[0][t],
      rawSingle: rawPaths[0][t],
    });
  }
  
  // Annualized volatilities from daily returns
  const factorDailyReturns = factorPaths[0].slice(1).map((v, i) => v - factorPaths[0][i]);
  const orthDailyReturns = orthPaths[0].slice(1).map((v, i) => v - orthPaths[0][i]);
  const rawDailyReturns = rawPaths[0].slice(1).map((v, i) => v - rawPaths[0][i]);
  
  const sigmaRawAnn = Math.sqrt(variance(rawDailyReturns)) * Math.sqrt(252);
  const sigmaOrthAnn = Math.sqrt(variance(orthDailyReturns)) * Math.sqrt(252);
  const riskReduction = 1 - sigmaOrthAnn / sigmaRawAnn;
  const theoreticalVarReduction = (beta * beta * sigmaF * sigmaF) / 
    (beta * beta * sigmaF * sigmaF + sigmaAlpha * sigmaAlpha);
  
  return { stats, sigmaRawAnn, sigmaOrthAnn, riskReduction, theoreticalVarReduction, beta };
};

// Slider component
const Slider = ({ label, value, onChange, min, max, step, format }) => (
  <div className="flex items-center gap-2 mb-2">
    <label className="w-20 text-xs font-mono">{label}</label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="flex-1 h-1"
    />
    <span className="w-16 text-xs font-mono text-right">{format ? format(value) : value.toFixed(2)}</span>
  </div>
);

export default function SignalOrthogonalization() {
  const [activeTab, setActiveTab] = useState('radio');
  
  // Radio signal params
  const [rhoRadio, setRhoRadio] = useState(0.7);
  const [noise, setNoise] = useState(0.15);
  const [f1, setF1] = useState(3);
  const [f2, setF2] = useState(3);
  const [radioSeed, setRadioSeed] = useState(42);
  
  // Finance params
  const [rhoFin, setRhoFin] = useState(0.6);
  const [muF, setMuF] = useState(0.08);
  const [muAlpha, setMuAlpha] = useState(0.05);
  const [sigmaF, setSigmaF] = useState(0.16);
  const [sigmaAlpha] = useState(0.08);
  const [showMC, setShowMC] = useState(true);
  const [finSeed, setFinSeed] = useState(123);
  
  const N = 256, fs = 100, M = 100, T = 252;
  
  // Generate radio signals
  const radio = useMemo(() => 
    generateRadioSignals(rhoRadio, noise, f1, f2, N, fs, radioSeed),
    [rhoRadio, noise, f1, f2, radioSeed]
  );
  
  // Generate finance paths
  const finance = useMemo(() => 
    generateFinancePaths(rhoFin, muF, muAlpha, sigmaF, sigmaAlpha, M, T, finSeed),
    [rhoFin, muF, muAlpha, sigmaF, sigmaAlpha, finSeed]
  );
  
  // Prepare time domain data
  const timeData = radio.t.map((ti, i) => ({
    t: ti,
    S1: radio.S1[i],
    S2: radio.S2[i],
    betaS1: radio.betaS1[i],
    S2_orth: radio.S2_orth[i],
  }));
  
  // Prepare frequency domain data with smart clipping
  const specS1 = dft(radio.S1, fs);
  const specS2 = dft(radio.S2, fs);
  const specBetaS1 = dft(radio.betaS1, fs);
  const specS2_orth = dft(radio.S2_orth, fs);
  
  // Find max significant frequency (where magnitude > 5% of peak)
  const allMags = [...specS1.map(s => s.mag), ...specS2.map(s => s.mag)];
  const peakMag = Math.max(...allMags);
  const threshold = peakMag * 0.05;
  let maxSignificantFreq = Math.max(f1, f2);
  for (let i = specS1.length - 1; i >= 0; i--) {
    if (specS1[i].mag > threshold || specS2[i].mag > threshold) {
      maxSignificantFreq = Math.max(maxSignificantFreq, specS1[i].freq);
      break;
    }
  }
  const freqCutoff = maxSignificantFreq + 5; // 5 Hz buffer
  
  const freqData = specS1
    .filter(s => s.freq <= freqCutoff)
    .map((s, i) => ({
      freq: s.freq,
      S1: s.mag,
      S2: specS2[i].mag,
      betaS1: specBetaS1[i].mag,
      S2_orth: specS2_orth[i].mag,
    }));

  return (
    <div className="p-4 bg-gray-900 text-gray-100 min-h-screen">
      <h1 className="text-xl font-bold mb-4">Signal Orthogonalization</h1>
      
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('radio')}
          className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'radio' ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          Radio Signals
        </button>
        <button
          onClick={() => setActiveTab('finance')}
          className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'finance' ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          Finance
        </button>
      </div>
      
      {/* Radio Signals Tab */}
      {activeTab === 'radio' && (
      <div>
        <h2 className="text-lg font-semibold mb-2 text-cyan-400">Radio Signals</h2>
        
        <div className="grid grid-cols-4 gap-4 mb-3 bg-gray-800 p-3 rounded">
          <Slider label="ρ" value={rhoRadio} onChange={setRhoRadio} min={0} max={0.95} step={0.05} />
          <Slider label="noise" value={noise} onChange={setNoise} min={0} max={0.5} step={0.05} />
          <Slider label="f₁ (Hz)" value={f1} onChange={setF1} min={1} max={8} step={0.5} />
          <Slider label="f₂ (Hz)" value={f2} onChange={setF2} min={1} max={8} step={0.5} />
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-2 text-xs font-mono bg-gray-800 p-2 rounded">
          <div>β = {radio.beta.toFixed(4)} | cov(S₁,S₂⊥) = {radio.actualCov.toFixed(6)}</div>
          <div>Explained: ρ² = {(radio.explainedVar * 100).toFixed(1)}% | Unique: 1-ρ² = {(radio.uniqueVar * 100).toFixed(1)}%</div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Time Domain */}
          <div className="bg-gray-800 p-2 rounded">
            <h3 className="text-sm mb-1">Time Domain</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="#888" />
                <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', fontSize: 10 }} />
                <Line type="monotone" dataKey="S1" stroke="#06b6d4" dot={false} strokeWidth={1} name="S₁" />
                <Line type="monotone" dataKey="S2" stroke="#ef4444" dot={false} strokeWidth={1} name="S₂" />
                <Line type="monotone" dataKey="betaS1" stroke="#a855f7" dot={false} strokeWidth={1} strokeDasharray="4 2" name="β·S₁" />
                <Line type="monotone" dataKey="S2_orth" stroke="#22c55e" dot={false} strokeWidth={1} name="S₂⊥" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Frequency Domain */}
          <div className="bg-gray-800 p-2 rounded">
            <h3 className="text-sm mb-1">Frequency Domain (DFT Magnitude)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={freqData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="freq" tick={{ fontSize: 10 }} stroke="#888" label={{ value: 'Hz', fontSize: 10, position: 'right' }} />
                <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', fontSize: 10 }} />
                <Line type="monotone" dataKey="S1" stroke="#06b6d4" dot={false} strokeWidth={1} name="|S₁|" />
                <Line type="monotone" dataKey="S2" stroke="#ef4444" dot={false} strokeWidth={1} name="|S₂|" />
                <Line type="monotone" dataKey="betaS1" stroke="#a855f7" dot={false} strokeWidth={1} strokeDasharray="4 2" name="|β·S₁|" />
                <Line type="monotone" dataKey="S2_orth" stroke="#22c55e" dot={false} strokeWidth={1} name="|S₂⊥|" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <button 
          onClick={() => setRadioSeed(s => s + 1)}
          className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
        >
          Reseed Noise
        </button>
        
        {/* S2 vs S2_orth comparison */}
        <div className="mt-4 bg-gray-800 p-2 rounded">
          <h3 className="text-sm mb-1">S₂ vs S₂⊥ Comparison</h3>
          <div className="grid grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={timeData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="#888" />
                <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', fontSize: 10 }} />
                <Line type="monotone" dataKey="S2" stroke="#ef4444" dot={false} strokeWidth={1} name="S₂" />
                <Line type="monotone" dataKey="S2_orth" stroke="#22c55e" dot={false} strokeWidth={1} name="S₂⊥" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={freqData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="freq" tick={{ fontSize: 10 }} stroke="#888" />
                <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', fontSize: 10 }} />
                <Line type="monotone" dataKey="S2" stroke="#ef4444" dot={false} strokeWidth={1} name="|S₂|" />
                <Line type="monotone" dataKey="S2_orth" stroke="#22c55e" dot={false} strokeWidth={1} name="|S₂⊥|" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      )}
      
      {/* Finance Tab */}
      {activeTab === 'finance' && (
      <div>
        <h2 className="text-lg font-semibold mb-2 text-green-400">Finance: Alpha Decomposition</h2>
        
        <div className="grid grid-cols-4 gap-4 mb-3 bg-gray-800 p-3 rounded">
          <Slider label="ρ (β)" value={rhoFin} onChange={setRhoFin} min={0} max={0.95} step={0.05} />
          <Slider label="μ_F" value={muF} onChange={setMuF} min={-0.1} max={0.2} step={0.01} format={v => (v*100).toFixed(0)+'%'} />
          <Slider label="μ_α" value={muAlpha} onChange={setMuAlpha} min={-0.05} max={0.15} step={0.01} format={v => (v*100).toFixed(0)+'%'} />
          <Slider label="σ_F" value={sigmaF} onChange={setSigmaF} min={0.08} max={0.3} step={0.01} format={v => (v*100).toFixed(0)+'%'} />
        </div>
        
        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={showMC} onChange={e => setShowMC(e.target.checked)} />
            Show MC Mean ± 90% CI
          </label>
          <button 
            onClick={() => setFinSeed(s => s + 1)}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
          >
            Reseed Paths
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-2 text-xs font-mono bg-gray-800 p-2 rounded">
          <div>β = {finance.beta.toFixed(3)} | σ(α_raw) = {(finance.sigmaRawAnn*100).toFixed(1)}% | σ(α_orth) = {(finance.sigmaOrthAnn*100).toFixed(1)}%</div>
          <div>Risk Reduction: {(finance.riskReduction*100).toFixed(1)}% | Theoretical Var Reduction: {(finance.theoreticalVarReduction*100).toFixed(1)}%</div>
        </div>
        
        <div className="bg-gray-800 p-2 rounded">
          <h3 className="text-sm mb-1">Cumulative Returns (252 days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={finance.stats} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#888" />
              <YAxis tick={{ fontSize: 10 }} stroke="#888" tickFormatter={v => (v*100).toFixed(0)+'%'} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', fontSize: 10 }} 
                formatter={(v) => (v*100).toFixed(1)+'%'}
              />
              
              {showMC ? (
                <>
                  <Line type="monotone" dataKey="factorP5" stroke="#06b6d4" dot={false} strokeWidth={1} strokeDasharray="2 2" name="Factor P5" legendType="none" />
                  <Line type="monotone" dataKey="factorP95" stroke="#06b6d4" dot={false} strokeWidth={1} strokeDasharray="2 2" name="Factor P95" legendType="none" />
                  <Line type="monotone" dataKey="factorMean" stroke="#06b6d4" dot={false} strokeWidth={2} name="Factor" />
                  
                  <Line type="monotone" dataKey="rawP5" stroke="#ef4444" dot={false} strokeWidth={1} strokeDasharray="2 2" name="Raw P5" legendType="none" />
                  <Line type="monotone" dataKey="rawP95" stroke="#ef4444" dot={false} strokeWidth={1} strokeDasharray="2 2" name="Raw P95" legendType="none" />
                  <Line type="monotone" dataKey="rawMean" stroke="#ef4444" dot={false} strokeWidth={2} name="α_raw" />
                  
                  <Line type="monotone" dataKey="orthP5" stroke="#22c55e" dot={false} strokeWidth={1} strokeDasharray="2 2" name="Orth P5" legendType="none" />
                  <Line type="monotone" dataKey="orthP95" stroke="#22c55e" dot={false} strokeWidth={1} strokeDasharray="2 2" name="Orth P95" legendType="none" />
                  <Line type="monotone" dataKey="orthMean" stroke="#22c55e" dot={false} strokeWidth={2} name="α_orth" />
                </>
              ) : (
                <>
                  <Line type="monotone" dataKey="factorSingle" stroke="#06b6d4" dot={false} strokeWidth={1.5} name="Factor" />
                  <Line type="monotone" dataKey="rawSingle" stroke="#ef4444" dot={false} strokeWidth={1.5} name="α_raw" />
                  <Line type="monotone" dataKey="orthSingle" stroke="#22c55e" dot={false} strokeWidth={1.5} name="α_orth" />
                </>
              )}
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-3 text-xs font-mono bg-gray-800 p-3 rounded">
          <div className="font-semibold mb-1">Formulas:</div>
          <div>α_raw = β·Factor + α_orth</div>
          <div>E[α_raw] = β·E[Factor] + E[α_orth] = {finance.beta.toFixed(2)}×{(muF*100).toFixed(0)}% + {(muAlpha*100).toFixed(0)}% = {((finance.beta*muF + muAlpha)*100).toFixed(1)}%</div>
          <div>σ²_raw = β²σ²_F + σ²_orth = {(finance.beta**2).toFixed(3)}×{(sigmaF**2*100).toFixed(2)} + {(sigmaAlpha**2*100).toFixed(2)}</div>
        </div>
      </div>
      )}
    </div>
  );
}

