
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RowData, Template } from './types';
import { PlusIcon, TrashIcon, SaveIcon, ShareIcon, DuplicateIcon } from './components/icons';

// Make TypeScript aware of the html-to-image library from the CDN
declare const htmlToImage: any;

const TEMPLATES_STORAGE_KEY = 'van_bill_manager_templates';

const getDatePartsForDisplay = (dateStr: string) => {
  if (!dateStr) return { date: '', day: '' };
  const date = new Date(`${dateStr}T00:00:00`);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return {
    date: `${day}.${month}.${year}`,
    day: date.toLocaleDateString('en-US', { weekday: 'long' }),
  };
};

const formatDateForDisplay = (dateStr: string): string => {
  const { date, day } = getDatePartsForDisplay(dateStr);
  return date ? `${date} ${day}` : '';
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
  const reportDateParts = getDatePartsForDisplay(reportDate);
  
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
    if (!newVan.trim() && !formattedTime && !newEWaybill && !newInvoice) return;

    const newItem: RowData = {
        id: crypto.randomUUID(),
        van: newVan.toUpperCase(),
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
        van: van.toUpperCase(),
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
          backgroundColor: '#ffffff'
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
    <div className="min-h-screen bg-[#f2f6f4] font-sans pb-32 text-slate-900">
      {/* App Header */}
      <header className="sticky top-0 z-10 border-b border-emerald-900/10 bg-[#0b6b50] px-5 py-4 text-white shadow-md">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="min-w-0">
                <h1 className="text-2xl font-extrabold leading-tight">Van Bill Manager</h1>
                <p className="mt-1 text-base font-semibold text-emerald-50">
                    {formatDateForDisplay(reportDate)}
                </p>
            </div>
            <label className="shrink-0">
                <span className="sr-only">Load a saved template</span>
                <select
                    onChange={handleLoadTemplate}
                    className="min-h-14 max-w-[150px] rounded-xl border border-white/40 bg-white px-3 text-sm font-bold text-[#075f48] outline-none focus:ring-4 focus:ring-emerald-200"
                >
                    <option value="">Templates</option>
                    {templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
            </label>
          </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        
        {/* 1. Add New Entry Form */}
        <section className="rounded-3xl border border-[#dce8e2] bg-white p-5 shadow-[0_8px_24px_rgba(27,65,48,0.07)] sm:p-6">
            <div className="mb-5">
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Add a van</h2>
                <p className="mt-1 text-sm font-medium text-slate-600">Fill in the details, then tap Add to list.</p>
            </div>
            <form onSubmit={handleAddItem} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="mb-2 block text-sm font-bold text-slate-800">Van name</label>
                        <input 
                            ref={vanInputRef}
                            type="text" 
                            value={newVan} 
                            onChange={e => setNewVan(e.target.value.toUpperCase())}
                            placeholder="Example: CJB-PON"
                            className="min-h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-lg font-semibold text-slate-900 outline-none transition focus:border-[#087a59] focus:ring-4 focus:ring-emerald-100 placeholder:font-normal placeholder:text-slate-500"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="mb-2 block text-sm font-bold text-slate-800">Van-out time <span className="font-medium text-slate-500">(optional)</span></label>
                        <div className="flex h-14 overflow-hidden rounded-xl border-2 border-slate-300 bg-white focus-within:border-[#087a59] focus-within:ring-4 focus-within:ring-emerald-100">
                            <select
                                value={tHour}
                                onChange={(e) => setTHour(e.target.value)}
                                className="min-w-0 flex-1 appearance-none bg-white px-2 text-lg font-semibold text-slate-900 outline-none"
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
                                className="w-16 border-x border-slate-300 bg-white text-center text-lg font-semibold text-slate-900 outline-none placeholder:text-slate-500"
                            />
                            <select
                                value={tAmPm}
                                onChange={(e) => setTAmPm(e.target.value)}
                                className="min-w-0 flex-1 appearance-none bg-white px-2 text-lg font-semibold text-slate-900 outline-none"
                                style={{ textAlignLast: 'center' }}
                            >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-bold text-slate-800">E-way bill <span className="font-medium text-slate-500">(optional)</span></label>
                        <input 
                            type="text" 
                            inputMode="numeric"
                            maxLength={3}
                            value={newEWaybill} 
                            onChange={e => setNewEWaybill(e.target.value.replace(/\D/g, '').slice(0, 3))}
                            placeholder="000"
                            className="min-h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-3 text-center text-xl font-bold tracking-wider text-slate-900 outline-none transition focus:border-[#087a59] focus:ring-4 focus:ring-emerald-100 placeholder:font-normal placeholder:text-slate-500"
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-bold text-slate-800">Invoice number <span className="font-medium text-slate-500">(optional)</span></label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={newInvoice}
                            onChange={e => setNewInvoice(e.target.value.replace(/\D/g, '').slice(0, 3))}
                            placeholder="000"
                            className="min-h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-3 text-center text-xl font-bold tracking-wider text-slate-900 outline-none transition focus:border-[#087a59] focus:ring-4 focus:ring-emerald-100 placeholder:font-normal placeholder:text-slate-500"
                        />
                    </div>
                    <button
                        type="submit"
                        aria-label="Add van to list"
                        className="col-span-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#087a59] px-4 text-white shadow-md transition hover:bg-[#066447] active:scale-[0.99]"
                    >
                        <PlusIcon /> <span className="text-base font-bold">Add van to list</span>
                    </button>
                </div>
            </form>
        </section>

        {/* 2. Controls Row */}
        <section aria-label="List actions" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button onClick={handleDuplicateLast} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-[#b8d9cb] bg-white px-4 py-3 text-base font-bold text-[#075f48] shadow-sm transition hover:bg-emerald-50 active:scale-[0.98]">
                <DuplicateIcon /> Duplicate Last
            </button>
            <button onClick={handleSaveTemplate} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-[#b8d9cb] bg-white px-4 py-3 text-base font-bold text-[#075f48] shadow-sm transition hover:bg-emerald-50 active:scale-[0.98]">
                <SaveIcon /> Save Template
            </button>
            <button onClick={handleClearTable} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-red-200 bg-white px-4 py-3 text-base font-bold text-red-700 shadow-sm transition hover:bg-red-50 active:scale-[0.98]">
                <TrashIcon /> Clear
            </button>
        </section>

        {/* 3. Preview & Capture Area */}
        <section className="overflow-hidden rounded-3xl border border-[#dce8e2] bg-white shadow-[0_8px_24px_rgba(27,65,48,0.07)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
                 <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Your report</h2>
                    <p className="mt-1 text-sm font-medium text-slate-600">Preview the image before sharing.</p>
                 </div>
                 <label className="flex min-h-12 cursor-pointer select-none items-center gap-3 rounded-xl bg-emerald-50 px-3 text-sm font-bold text-[#075f48]">
                    <input
                        type="checkbox"
                        checked={showVanOut}
                        onChange={e => setShowVanOut(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-400 text-emerald-700 focus:ring-emerald-600"
                    />
                    Add VAN OUT column
                 </label>
            </div>
            
            <details className="border-b border-slate-200 bg-[#f8faf9]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-base font-bold text-slate-800">
                Edit report details
                <span className="text-sm font-semibold text-[#087a59]">Tap to open</span>
              </summary>
            <div className="grid grid-cols-1 gap-4 border-t border-slate-200 p-5 sm:grid-cols-2">
                <label className="text-sm font-bold tracking-wide text-slate-700">
                    Report title
                    <input value={title} onChange={e => setTitle(e.target.value)} className="mt-2 min-h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-base font-medium normal-case tracking-normal text-slate-900 focus:border-[#087a59] focus:outline-none focus:ring-4 focus:ring-emerald-100" />
                </label>
                <label className="text-sm font-bold tracking-wide text-slate-700">
                    Report date
                    <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="mt-2 min-h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-base font-medium normal-case tracking-normal text-slate-900 focus:border-[#087a59] focus:outline-none focus:ring-4 focus:ring-emerald-100" />
                </label>
                <label className="text-sm font-bold tracking-wide text-slate-700">
                    Footer name
                    <input value={footerName} onChange={e => setFooterName(e.target.value)} className="mt-2 min-h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-base font-medium normal-case tracking-normal text-slate-900 focus:border-[#087a59] focus:outline-none focus:ring-4 focus:ring-emerald-100" />
                </label>
                <label className="text-sm font-bold tracking-wide text-slate-700">
                    Footer subtitle
                    <input value={footerSubtitle} onChange={e => setFooterSubtitle(e.target.value)} className="mt-2 min-h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-base font-medium normal-case tracking-normal text-slate-900 focus:border-[#087a59] focus:outline-none focus:ring-4 focus:ring-emerald-100" />
                </label>
            </div>
            </details>

            <div className="w-full">
                <div
                    ref={captureRef}
                    className={`mx-auto ${isExporting ? 'w-[390px] max-w-none' : 'w-full max-w-[590px]'} bg-[#e7efeb] px-3 pt-3 pb-7 font-sans`}
                >
                    <div className="overflow-hidden rounded-xl border border-[#d6eee5] bg-[#f4f8f6]">
                        <div className="min-h-[132px] bg-[#0b8d65] px-4 py-4 sm:px-6">
                            <p className="text-lg font-bold text-white">
                                {reportDateParts.date} <span className="mx-1 text-white/70">·</span> {reportDateParts.day}
                            </p>
                            <h1 className="mt-2 text-[clamp(32px,8vw,44px)] font-extrabold leading-none tracking-[-0.05em] text-white">
                                {title.trim() || 'MVX hub'}
                            </h1>
                        </div>

                        <div className="mx-3 -mt-5 mb-4 overflow-hidden rounded-xl border border-[#d6eee5] bg-white shadow-[0_8px_18px_rgba(20,80,60,0.1)] sm:mx-5">
                            <table className="w-full table-fixed border-collapse text-left">
                                <colgroup>
                                    <col style={{ width: isExporting ? '11%' : '0%' }} />
                                    {showVanOut ? (
                                        <>
                                            <col style={{ width: isExporting ? '35%' : '47%' }} />
                                            <col style={{ width: '18%' }} />
                                            <col style={{ width: isExporting ? '18%' : '17.5%' }} />
                                            <col style={{ width: isExporting ? '18%' : '17.5%' }} />
                                        </>
                                    ) : (
                                        <>
                                            <col style={{ width: isExporting ? '54%' : '65%' }} />
                                            <col style={{ width: isExporting ? '17.5%' : '17.5%' }} />
                                            <col style={{ width: isExporting ? '17.5%' : '17.5%' }} />
                                        </>
                                    )}
                                </colgroup>
                                <thead>
                                    <tr className="h-11 bg-[#e8f6f1]">
                                        <th className={`${isExporting ? '' : 'hidden'} border-r border-[#d6eee5] px-1 text-center text-[10px] font-bold text-[#315d50]`}>S.NO</th>
                                        <th className="border-r border-[#d6eee5] px-2 text-xs font-bold text-[#315d50]">VAN</th>
                                        {showVanOut && <th className="border-r border-[#d6eee5] px-1 text-center text-[10px] font-bold text-[#315d50]">VAN OUT</th>}
                                        <th className="border-r border-[#d6eee5] px-1 text-center text-[10px] font-bold text-[#078760]">EWAY</th>
                                        <th className="px-1 text-center text-[10px] font-bold text-[#ef5b55]">INV</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={3 + Number(showVanOut) + Number(isExporting)} className="p-6 text-center text-sm font-medium text-slate-500">
                                                No items added yet
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((row, index) => (
                                            <React.Fragment key={row.id}>
                                                <tr className={`border-t border-[#dcefe8] ${index % 2 ? 'bg-[#f8fbf9]' : 'bg-white'}`}>
                                                    <td className={`${isExporting ? 'border-r border-[#dcefe8]' : 'hidden'} px-1 text-center`}>
                                                        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#078f67] px-1 text-xs font-bold text-white">{String(index + 1).padStart(2, '0')}</span>
                                                    </td>
                                                    <td className="border-r border-[#dcefe8] px-2 py-3 text-base font-semibold leading-snug text-[#14251f]">
                                                        <div className="break-words">{row.van || '-'}</div>
                                                    </td>
                                                    {showVanOut && (
                                                        <td className="border-r border-[#dcefe8] px-1 text-center text-sm font-medium text-[#7caa98]">
                                                            {row.vanOut || '—'}
                                                        </td>
                                                    )}
                                                    <td className="border-r border-[#dcefe8] px-1 text-center">
                                                        <span className="inline-flex min-w-[36px] justify-center rounded-lg bg-[#d8f4e9] px-1 py-1 text-base font-bold text-[#087a59]">{row.eWaybill || '—'}</span>
                                                    </td>
                                                    <td className="px-1 text-center">
                                                        <span className="inline-flex min-w-[36px] justify-center rounded-lg bg-[#ffe3e1] px-1 py-1 text-base font-bold text-[#ec514d]">{row.invoice || '—'}</span>
                                                    </td>
                                                </tr>
                                                {!isExporting && (
                                                    <tr className={index % 2 ? 'bg-[#f8fbf9]' : 'bg-white'}>
                                                        <td colSpan={3 + Number(showVanOut)} className="border-b border-[#dcefe8] px-2 py-1">
                                                                                    <div className="flex justify-end gap-2">
                                                                                        <button onClick={() => handleDuplicateRow(row)} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#cce9dd] px-3 text-sm font-semibold text-[#087a59] hover:bg-[#e8f6f1]" aria-label={`Duplicate ${row.van || 'row'}`}>
                                                                    <DuplicateIcon /> Duplicate
                                                                </button>
                                                                <button onClick={() => handleRemoveRow(row.id)} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#f4d0cd] px-3 text-sm font-semibold text-[#d94b46] hover:bg-[#fff1f0]" aria-label={`Remove ${row.van || 'row'}`}>
                                                                    <TrashIcon /> Remove
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="px-4 sm:px-6 pb-12 pt-6 text-right">
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
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,35,25,0.12)] backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <button 
            onClick={handleShare}
            disabled={isLoading}
            className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#087a59] px-6 py-4 text-xl font-extrabold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-[#066447] active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
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
    </div>
  );
};

export default App;
