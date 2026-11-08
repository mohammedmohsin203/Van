
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RowData, Template } from './types';
import { PlusIcon, TrashIcon, SaveIcon, ShareIcon, DuplicateIcon } from './components/icons';

// Make TypeScript aware of the html-to-image library from the CDN
declare const htmlToImage: any;

const TEMPLATES_STORAGE_KEY = 'van_bill_manager_templates';

const formatDateForDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  return `${day}.${month}.${year} ${weekday}`;
};

const App: React.FC = () => {
  // Table Data State
  const [rows, setRows] = useState<RowData[]>([]);
  
  // New Entry Form State
  const [newVan, setNewVan] = useState('');
  
  // Custom Time Picker State
  const [tHour, setTHour] = useState('');
  const [tMin, setTMin] = useState('');
  const [tAmPm, setTAmPm] = useState('PM');

  const [newEWaybill, setNewEWaybill] = useState('');
  const [newInvoice, setNewInvoice] = useState('');

  const [templates, setTemplates] = useState<Template[]>([]);
  
  // Header and Footer state
  const [title, setTitle] = useState("MVX hub");
  const [reportDate, setReportDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [footerName, setFooterName] = useState("Basheer Ahamed");
  const [footerSubtitle, setFooterSubtitle] = useState("TPC / MAA / MVX");
  const [showVanOut, setShowVanOut] = useState(true);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const captureRef = useRef<HTMLDivElement>(null);
  
  // Refs for focusing inputs
  const vanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const storedTemplates = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (storedTemplates) {
        setTemplates(JSON.parse(storedTemplates));
      }
    } catch (error) {
      console.error("Failed to load templates from localStorage", error);
    }
  }, []);

  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Construct Time String
    let formattedTime = '';
    if (tHour) {
        const m = tMin ? tMin.padStart(2, '0') : '00';
        formattedTime = `${tHour}:${m} ${tAmPm}`;
    }

    // Basic validation: ensure at least one field has data
    if (!newVan && !formattedTime && !newEWaybill && !newInvoice) return;

    const newItem: RowData = {
        id: crypto.randomUUID(),
        van: newVan,
        vanOut: formattedTime,
        eWaybill: newEWaybill,
        invoice: newInvoice
    };

    setRows([...rows, newItem]);
    
    // Reset form
    setNewVan('');
    setTHour('');
    setTMin('');
    setTAmPm('PM');
    setNewEWaybill('');
    setNewInvoice('');
    
    // Refocus first input
    vanInputRef.current?.focus();
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleDuplicateRow = (row: RowData) => {
      const newItem = { ...row, id: crypto.randomUUID() };
      setRows([...rows, newItem]);
  };

  const handleDuplicateLast = () => {
      if (rows.length === 0) return;
      handleDuplicateRow(rows[rows.length - 1]);
  };

  const handleSaveTemplate = () => {
    const templateName = prompt("Enter a name for this template:");
    if (templateName && templateName.trim() !== "") {
      const vans = rows.map(row => row.van).filter(van => van.trim() !== "");
      if (vans.length === 0) {
        alert("Cannot save an empty template.");
        return;
      }
      const newTemplate: Template = { name: templateName.trim(), vans };
      const updatedTemplates = [...templates.filter(t => t.name !== newTemplate.name), newTemplate];
      setTemplates(updatedTemplates);
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
      alert(`Template "${newTemplate.name}" saved!`);
    }
  };

  const handleLoadTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateName = e.target.value;
    if (!templateName) return;

    if (rows.length > 0 && !window.confirm("Replace current list with template?")) {
      e.target.value = "";
      return;
    }

    const template = templates.find(t => t.name === templateName);
    if (template) {
      const newRows: RowData[] = template.vans.map(van => ({
        id: crypto.randomUUID(),
        van,
        vanOut: '',
        eWaybill: '',
        invoice: '',
      }));
      setRows(newRows);
    }
    e.target.value = "";
  };

  const handleClearTable = () => {
    if (window.confirm("Clear all items?")) {
        setRows([]);
    }
  };
  
  const handleShare = useCallback(async () => {
    if (!captureRef.current) return;
    setIsLoading(true);
    setIsExporting(true); 

    setTimeout(async () => {
      try {
        const dataUrl = await htmlToImage.toPng(captureRef.current, {
          quality: 1.0,
          pixelRatio: 3,
          backgroundColor: '#ffffff',
          style: {
             minWidth: '590px',
             maxWidth: 'none',
             transform: 'none'
          }
        });
        
        const blob = await(await fetch(dataUrl)).blob();
        const filename = `AVX_Report_${reportDate}.png`;
        const file = new File([blob], filename, { type: "image/png" });
        
        if (navigator.share && navigator.canShare({ files: [file] })) {
           await navigator.share({
                title: 'AVX Hub Report',
                text: `Report for ${formatDateForDisplay(reportDate)}`,
                files: [file],
            });
        } else {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

      } catch (error) {
        console.error('Generation failed', error);
        alert('Failed to generate image. Please try again.');
      } finally {
        setIsExporting(false);
        setIsLoading(false);
      }
    }, 300); 
  }, [reportDate]);

  return (
    <div className="bg-slate-100 min-h-screen font-sans pb-24">
      {/* App Header */}
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 border-b border-slate-200">
          <div className="max-w-3xl mx-auto flex justify-between items-center">
            <div>
                <h1 className="text-lg font-bold text-slate-800">Van Bill Manager</h1>
                <p className="text-[10px] text-slate-500 font-medium tracking-wide">
                    {formatDateForDisplay(reportDate)}
                </p>
            </div>
            <select 
                onChange={handleLoadTemplate} 
                className="bg-slate-50 text-xs border border-slate-200 rounded-md text-slate-700 px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
                <option value="">Load Template...</option>
                {templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        
        {/* 1. Add New Entry Form */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">New Entry</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Van Name</label>
                        <input 
                            ref={vanInputRef}
                            type="text" 
                            value={newVan} 
                            onChange={e => setNewVan(e.target.value)}
                            placeholder="e.g. CJB-PON" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder-slate-300"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Time</label>
                        <div className="flex shadow-sm rounded-lg h-[42px]">
                            <select
                                value={tHour}
                                onChange={(e) => setTHour(e.target.value)}
                                className="flex-1 min-w-0 bg-slate-50 border border-slate-200 text-slate-800 text-sm text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-l-lg appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
                                style={{ textAlignLast: 'center' }}
                            >
                                <option value="" className="text-slate-400">Hr</option>
                                {[...Array(12)].map((_, i) => (
                                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={tMin}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                                    setTMin(val);
                                }}
                                placeholder="00"
                                className="w-12 bg-slate-50 border-y border-slate-200 text-slate-800 text-sm text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 placeholder-slate-400"
                            />
                            <select
                                value={tAmPm}
                                onChange={(e) => setTAmPm(e.target.value)}
                                className="flex-1 min-w-0 bg-slate-50 border border-slate-200 text-slate-800 text-sm text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-r-lg appearance-none cursor-pointer hover:bg-slate-100 transition-colors font-medium"
                                style={{ textAlignLast: 'center' }}
                            >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">EWAY</label>
                        <input 
                            type="text" 
                            value={newEWaybill} 
                            onChange={e => setNewEWaybill(e.target.value)}
                            placeholder="-" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-300 h-[42px]"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Invoice</label>
                         <div className="flex gap-3">
                            <input 
                                type="text" 
                                value={newInvoice} 
                                onChange={e => setNewInvoice(e.target.value)}
                                placeholder="0" 
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-300"
                            />
                            <button 
                                type="submit" 
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg px-6 transition-colors flex items-center justify-center shadow-sm"
                            >
                                <PlusIcon />
                            </button>
                         </div>
                    </div>
                </div>
            </form>
        </section>

        {/* 2. Controls Row */}
        <section className="flex flex-wrap gap-2 justify-end">
            <button onClick={handleDuplicateLast} className="text-xs text-indigo-600 font-semibold px-4 py-2 bg-white border border-indigo-100 rounded-lg hover:bg-indigo-50 flex items-center gap-1.5 shadow-sm transition-all">
                <DuplicateIcon /> Duplicate Last
            </button>
            <button onClick={handleSaveTemplate} className="text-xs text-indigo-600 font-semibold px-4 py-2 bg-white border border-indigo-100 rounded-lg hover:bg-indigo-50 flex items-center gap-1.5 shadow-sm transition-all">
                <SaveIcon /> Save Template
            </button>
            <button onClick={handleClearTable} className="text-xs text-red-600 font-semibold px-4 py-2 bg-white border border-red-100 rounded-lg hover:bg-red-50 flex items-center gap-1.5 shadow-sm transition-all">
                <TrashIcon /> Clear
            </button>
        </section>

        {/* 3. Preview & Capture Area */}
        <section className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
            <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex justify-between items-center backdrop-blur-sm">
                 <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preview</h2>
                 <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={showVanOut}
                        onChange={e => setShowVanOut(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    Add VAN OUT column
                 </label>
            </div>
            
            <div className="grid grid-cols-2 gap-3 p-4 border-b border-slate-100">
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Report title
                    <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium normal-case tracking-normal text-slate-700" />
                </label>
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Report date
                    <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium normal-case tracking-normal text-slate-700" />
                </label>
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Footer name
                    <input value={footerName} onChange={e => setFooterName(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium normal-case tracking-normal text-slate-700" />
                </label>
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Footer subtitle
                    <input value={footerSubtitle} onChange={e => setFooterSubtitle(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium normal-case tracking-normal text-slate-700" />
                </label>
            </div>

            <div className="overflow-x-auto w-full">
                <div
                    ref={captureRef}
                    className={`mx-auto w-full max-w-[590px] bg-[#e7efeb] px-[22px] pt-3 pb-7 font-sans ${isExporting ? 'min-w-[590px]' : ''}`}
                >
                    <p className="mb-2 text-[14px] font-bold tracking-wide text-[#075f48]">2h · Emerald &amp; Coral</p>
                    <div className="overflow-hidden bg-[#f4f8f6]">
                        <div className="h-[205px] bg-[#0b8d65] px-6 pt-8">
                            <div className="flex items-center justify-between gap-3">
                                <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-white">
                                    <span className="h-2 w-2 rounded-full bg-[#ffc85a]" />
                                    DAILY VAN REPORT
                                </p>
                                <p className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#078760]">
                                    {formatDateForDisplay(reportDate).split(' ').slice(0, 1)}
                                    <span className="mx-2 text-slate-300">|</span>
                                    <span className="font-medium text-[#ed6b64]">{formatDateForDisplay(reportDate).split(' ').slice(1).join(' ')}</span>
                                </p>
                            </div>
                            <h1 className="mt-3 text-[clamp(34px,8vw,56px)] font-extrabold leading-tight tracking-[-0.06em] text-white">
                                {title.trim().split(/\s+/).slice(0, -1).join(' ')}{' '}
                                <span className="text-[#ffc85a]">{title.trim().split(/\s+/).slice(-1)}</span>
                            </h1>
                        </div>

                        <div className="relative mx-6 -mt-[43px] overflow-hidden rounded-[14px] border border-[#d6eee5] bg-white shadow-[0_12px_24px_rgba(20,80,60,0.12)]">
                            <table className="w-full table-fixed border-collapse text-left">
                                <thead>
                                    <tr className="h-[42px] bg-[#e8f6f1]">
                                        <th className="w-[56px] border-r border-[#d6eee5] px-2 text-center text-[11px] font-bold text-[#315d50]">S.NO</th>
                                        <th className={`border-r border-[#d6eee5] px-3 text-[11px] font-bold text-[#315d50] ${showVanOut ? '' : 'w-[38%]'}`}>VAN</th>
                                        {showVanOut && <th className="w-[87px] border-r border-[#d6eee5] px-1 text-center text-[11px] font-bold text-[#315d50]">VAN OUT</th>}
                                        <th className="w-[87px] border-r border-[#d6eee5] px-1 text-center text-[11px] font-bold text-[#078760]">EWAY</th>
                                        <th className="w-[86px] px-1 text-center text-[11px] font-bold text-[#ef5b55]">INV</th>
                                        {!isExporting && <th className="w-16 bg-[#e8f6f1] text-center text-[10px] font-bold text-slate-400">ACTION</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={2 + Number(showVanOut) + 2 + Number(!isExporting)} className="p-8 text-center text-sm font-medium text-slate-400">
                                                No items added yet
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((row, index) => (
                                            <tr key={row.id} className={`h-[46px] border-t border-[#dcefe8] ${index % 2 ? 'bg-[#f8fbf9]' : 'bg-white'}`}>
                                                <td className="border-r border-[#dcefe8] px-2 text-center">
                                                    <span className="inline-flex h-[28px] min-w-[28px] items-center justify-center rounded-lg bg-[#078f67] px-1 text-[11px] font-bold text-white">{String(index + 1).padStart(2, '0')}</span>
                                                </td>
                                                <td className="border-r border-[#dcefe8] px-3 text-[14px] font-semibold text-[#14251f]">
                                                    <div className={`${isExporting ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>{row.van || '-'}</div>
                                                </td>
                                                {showVanOut && (
                                                    <td className="border-r border-[#dcefe8] px-1 text-center text-xs font-medium text-[#b8d7cb]">
                                                        {row.vanOut || '—'}
                                                    </td>
                                                )}
                                                <td className="border-r border-[#dcefe8] px-1 text-center">
                                                    <span className="inline-flex min-w-[44px] justify-center rounded-lg bg-[#d8f4e9] px-2 py-1 text-sm font-bold text-[#087a59]">{row.eWaybill || '—'}</span>
                                                </td>
                                                <td className="px-1 text-center">
                                                    <span className="inline-flex min-w-[44px] justify-center rounded-lg bg-[#ffe3e1] px-2 py-1 text-sm font-bold text-[#ec514d]">{row.invoice || '—'}</span>
                                                </td>
                                                {!isExporting && (
                                                    <td className="px-1 text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button onClick={() => handleDuplicateRow(row)} className="rounded p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700" title="Duplicate">
                                                                <DuplicateIcon />
                                                            </button>
                                                            <button onClick={() => handleRemoveRow(row.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Remove">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="px-6 pb-12 pt-6 text-right">
                            <div className="ml-auto mb-2 h-[2px] w-8 rounded-full bg-[#ff625a]" />
                            <p className="text-[17px] font-bold text-[#078760]">{footerName}</p>
                            {footerSubtitle && <p className="mt-1 text-[11px] font-medium tracking-wide text-[#55796c]">{footerSubtitle}</p>}
                        </div>
                    </div>
                </div>
            </div>
        </section>

      </main>

      {/* Fixed Bottom Action Button */}
      <div className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto z-50">
          <button 
            onClick={handleShare}
            disabled={isLoading}
            className="w-full bg-slate-900 shadow-xl shadow-slate-900/20 text-white font-bold py-4 px-6 rounded-2xl hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-3 text-lg"
          >
             {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                   <>
                    <ShareIcon />
                    Share Image
                   </>
                )}
          </button>
      </div>
    </div>
  );
};

export default App;
