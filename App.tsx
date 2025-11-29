
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RowData, Template } from './types';
import { PlusIcon, TrashIcon, SaveIcon, ShareIcon } from './components/icons';

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

const normalizeTime = (input: string): string => {
  if (!input) return '';
  let clean = input.trim().replace(/\./g, ':'); // Convert 6.30 to 6:30
  
  // Handle simple 3 or 4 digit inputs (e.g. "630" -> "6:30", "1830" -> "18:30")
  if (/^\d{3,4}$/.test(clean)) {
    const len = clean.length;
    const h = clean.slice(0, len - 2);
    const m = clean.slice(len - 2);
    // Recursively call with colon format to let Date parser handle AM/PM
    clean = `${h}:${m}`;
  }

  // Use Date parser for robust time handling
  // We use a dummy date. "1/1/2000" works well with most time strings in JS
  const date = new Date(`1/1/2000 ${clean}`);
  if (!isNaN(date.getTime())) {
    // Format to HH:MM AM/PM
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
  
  return input; // Return original if parsing fails
};

const App: React.FC = () => {
  const [rows, setRows] = useState<RowData[]>([
    { id: crypto.randomUUID(), van: 'CJB-PON', vanOut: '', eWaybill: '1', invoice: '3' },
    { id: crypto.randomUUID(), van: 'CJB-TVL', vanOut: '', eWaybill: '', invoice: '7' },
  ]);
  const [templates, setTemplates] = useState<Template[]>([]);
  
  // Header and Footer state
  const [title, setTitle] = useState("AVX hub");
  const [reportDate, setReportDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [footerName, setFooterName] = useState("- Basheer Ahamed");
  const [footerSubtitle, setFooterSubtitle] = useState("");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const captureRef = useRef<HTMLDivElement>(null);

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

  const handleAddRow = () => {
    setRows([...rows, { id: crypto.randomUUID(), van: '', vanOut: '', eWaybill: '', invoice: '' }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof Omit<RowData, 'id'>, value: string) => {
    setRows(rows.map(row => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const handleTimeBlur = (id: string, value: string) => {
    const formatted = normalizeTime(value);
    handleUpdateRow(id, 'vanOut', formatted);
  };

  const handleSaveTemplate = () => {
    const templateName = prompt("Enter a name for this template:");
    if (templateName && templateName.trim() !== "") {
      const vans = rows.map(row => row.van).filter(van => van.trim() !== "");
      if (vans.length === 0) {
        alert("Cannot save an empty template. Please add VANs to the table.");
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

    if (rows.length > 0 && !window.confirm("Loading a template will replace the current table. Are you sure?")) {
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
    if (window.confirm("Are you sure you want to clear the entire table?")) {
        setRows([]);
    }
  };
  
  const downloadImage = useCallback((dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleShare = useCallback(async () => {
    if (!captureRef.current) return;
    setIsLoading(true);
    setIsExporting(true);

    // Wait for state update to reflect in DOM
    setTimeout(async () => {
      try {
        const dataUrl = await htmlToImage.toPng(captureRef.current, {
          quality: 1.0,
          pixelRatio: 3,
          backgroundColor: '#ffffff',
        });
        
        const blob = await(await fetch(dataUrl)).blob();
        const file = new File([blob], "avx-hub-report.png", { type: "image/png" });
        
        if (navigator.share && navigator.canShare({ files: [file] })) {
           await navigator.share({
                title: 'AVX Hub Report',
                text: `Report for ${formatDateForDisplay(reportDate)}`,
                files: [file],
            });
        } else {
            downloadImage(dataUrl, 'avx-hub-report.png');
        }

      } catch (error) {
        console.error('Oops, something went wrong!', error);
        alert('Failed to generate image. Please try again.');
      } finally {
        setIsExporting(false);
        setIsLoading(false);
      }
    }, 200);
  }, [reportDate, downloadImage]);

  return (
    <div className="bg-slate-100 min-h-screen font-sans p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl mx-auto">
        <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-800">Van Bill Manager</h1>
            <p className="text-slate-500 mt-1">Create and share daily reports with ease.</p>
        </header>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-700 mb-3 border-b pb-2">Templates & Controls</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col">
                    <label htmlFor="template-select" className="text-sm font-medium text-slate-600 mb-1">Load Template</label>
                    <select id="template-select" onChange={handleLoadTemplate} className="p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="">Select a template...</option>
                        {templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col justify-end">
                    <button onClick={handleSaveTemplate} className="w-full bg-indigo-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2">
                        <SaveIcon />
                        Save as Template
                    </button>
                </div>
            </div>
             <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row gap-4">
                 <button onClick={handleAddRow} className="w-full bg-green-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-600 transition-colors flex items-center justify-center gap-2">
                    <PlusIcon />
                    Add Row
                </button>
                 <button onClick={handleClearTable} className="w-full bg-red-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
                    <TrashIcon />
                    Clear Table
                </button>
            </div>
        </div>

        {/* This is the component that will be captured */}
        <div ref={captureRef} className="bg-white p-8">
            <div className="w-full">
              {/* Editable Title */}
              {isExporting ? (
                 <h1 className="text-3xl text-gray-800 font-bold mb-1">{title}</h1>
              ) : (
                 <input 
                   type="text" 
                   value={title} 
                   onChange={(e) => setTitle(e.target.value)} 
                   className="text-3xl text-gray-800 font-bold mb-1 w-full border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none bg-transparent"
                 />
              )}
              
              {/* Editable Date (Date Picker) */}
              <div className="mb-6">
                {isExporting ? (
                    <p className="text-xl text-gray-600">{formatDateForDisplay(reportDate)}</p>
                ) : (
                    <input 
                        type="date" 
                        value={reportDate} 
                        onChange={(e) => setReportDate(e.target.value)}
                        className="text-xl text-gray-600 border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none bg-transparent font-sans"
                    />
                )}
              </div>
              
              <div className="border border-gray-300 rounded-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-300">
                    <th className="p-2 border-r border-gray-300 text-sm font-semibold text-gray-600 uppercase w-auto text-left">VAN</th>
                    <th className="p-2 border-r border-gray-300 text-sm font-semibold text-gray-600 uppercase w-28 text-center">VAN OUT</th>
                    <th className="p-2 border-r border-gray-300 text-sm font-semibold text-gray-600 uppercase w-24 text-center">E WAYBILL</th>
                    <th className="p-2 border-r border-gray-300 text-sm font-semibold text-gray-600 uppercase w-24 text-center">INVOICE</th>
                    {!isExporting && (
                        <th className="p-2 w-[40px] text-center bg-white"></th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      {/* VAN Column */}
                      <td className="p-2 align-top border-r border-gray-300">
                        {isExporting ? (
                            <div className="whitespace-pre-wrap break-words text-lg text-gray-800">{row.van}</div>
                        ) : (
                            <textarea 
                                value={row.van} 
                                onChange={(e) => handleUpdateRow(row.id, 'van', e.target.value)} 
                                className="w-full bg-transparent focus:outline-none focus:bg-slate-100 rounded px-1 text-lg resize-none overflow-hidden min-h-[1.75rem]"
                                placeholder="e.g. CJB-MAA"
                                rows={1}
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = target.scrollHeight + 'px';
                                }}
                            />
                        )}
                      </td>
                      
                      {/* VAN OUT Column (Time) */}
                      <td className="p-2 align-top text-center border-r border-gray-300">
                        {isExporting ? (
                            <div className="text-lg text-gray-800 whitespace-nowrap">{row.vanOut || '—'}</div>
                        ) : (
                             <input 
                                type="text" 
                                value={row.vanOut} 
                                onChange={(e) => handleUpdateRow(row.id, 'vanOut', e.target.value)} 
                                onBlur={(e) => handleTimeBlur(row.id, e.target.value)}
                                className="w-full bg-transparent focus:outline-none focus:bg-slate-100 rounded px-1 text-lg text-center" 
                                placeholder="HH:MM" 
                            />
                        )}
                      </td>

                      {/* E WAYBILL Column */}
                      <td className="p-2 align-top text-center border-r border-gray-300">
                        {isExporting ? (
                             <div className="text-lg text-gray-800">{row.eWaybill || '—'}</div>
                        ) : (
                            <input 
                                type="text" 
                                value={row.eWaybill} 
                                onChange={(e) => handleUpdateRow(row.id, 'eWaybill', e.target.value)} 
                                className="w-full bg-transparent focus:outline-none focus:bg-slate-100 rounded px-1 text-lg text-center" 
                                placeholder="—" 
                            />
                        )}
                      </td>

                      {/* INVOICE Column */}
                      <td className="p-2 align-top text-center border-r border-gray-300">
                         {isExporting ? (
                             <div className="text-lg text-gray-800">{row.invoice || '—'}</div>
                        ) : (
                            <input 
                                type="text" 
                                value={row.invoice} 
                                onChange={(e) => handleUpdateRow(row.id, 'invoice', e.target.value)} 
                                className="w-full bg-transparent focus:outline-none focus:bg-slate-100 rounded px-1 text-lg text-center" 
                                placeholder="0" 
                            />
                        )}
                      </td>

                      {/* Delete Action - Hidden on Export */}
                      {!isExporting && (
                          <td className="p-2 text-center align-middle border-none bg-white">
                            <button onClick={() => handleRemoveRow(row.id)} className="text-gray-400 hover:text-red-500 p-1">
                                <TrashIcon />
                            </button>
                          </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              
              {rows.length === 0 && <p className="text-center text-gray-500 py-8">Table is empty. Click "Add Row" to begin.</p>}
               
               <div className="flex flex-col items-end mt-8">
                  {isExporting ? (
                    <>
                        <p className="text-gray-700 text-lg font-medium">{footerName}</p>
                        {footerSubtitle && <p className="text-gray-500 text-sm mt-1">{footerSubtitle}</p>}
                    </>
                  ) : (
                    <>
                        <input 
                            type="text" 
                            value={footerName} 
                            onChange={(e) => setFooterName(e.target.value)}
                            className="text-right text-gray-700 text-lg font-medium border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none bg-transparent w-full sm:w-1/2"
                        />
                        <input 
                            type="text" 
                            value={footerSubtitle} 
                            onChange={(e) => setFooterSubtitle(e.target.value)}
                            placeholder="Add subtitle..."
                            className="text-right text-gray-500 text-sm mt-1 border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none bg-transparent w-full sm:w-1/2"
                        />
                    </>
                  )}
               </div>
            </div>
        </div>

         <div className="mt-6">
            <button 
                onClick={handleShare}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-3 text-lg disabled:bg-slate-400 disabled:cursor-wait"
            >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Image...
                  </>
                ) : (
                   <>
                    <ShareIcon />
                    Update Date & Share Image
                   </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default App;
