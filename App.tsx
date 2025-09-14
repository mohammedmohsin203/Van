
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RowData, Template } from './types';
import { PlusIcon, TrashIcon, SaveIcon, ShareIcon } from './components/icons';

// Make TypeScript aware of the html-to-image library from the CDN
declare const htmlToImage: any;

const TEMPLATES_STORAGE_KEY = 'van_bill_manager_templates';

const formatDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  return `${day}.${month}.${year} ${weekday}`;
};

const App: React.FC = () => {
  const [rows, setRows] = useState<RowData[]>([
    { id: crypto.randomUUID(), van: 'CJB-PON', eWaybill: '1', invoice: '3' },
    { id: crypto.randomUUID(), van: 'CJB-TVL', eWaybill: '', invoice: '7' },
  ]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dateString, setDateString] = useState<string>(formatDate(new Date()));
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
    setRows([...rows, { id: crypto.randomUUID(), van: '', eWaybill: '', invoice: '' }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof Omit<RowData, 'id'>, value: string) => {
    setRows(rows.map(row => (row.id === id ? { ...row, [field]: value } : row)));
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
    setDateString(formatDate(new Date()));

    // Wait for state update to reflect in DOM
    setTimeout(async () => {
      try {
        const dataUrl = await htmlToImage.toPng(captureRef.current, {
          quality: 1.0,
          pixelRatio: 3, // Higher resolution for crisp text
          backgroundColor: '#ffffff',
        });
        
        const blob = await(await fetch(dataUrl)).blob();
        const file = new File([blob], "avx-hub-report.png", { type: "image/png" });
        
        if (navigator.share && navigator.canShare({ files: [file] })) {
           await navigator.share({
                title: 'AVX Hub Report',
                text: `Report for ${dateString}`,
                files: [file],
            });
        } else {
            downloadImage(dataUrl, 'avx-hub-report.png');
        }

      } catch (error) {
        console.error('Oops, something went wrong!', error);
        alert('Failed to generate image. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, 200);
  }, [dateString, downloadImage]);


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
              <h1 className="text-3xl text-gray-800">MVX hub</h1>
              <p className="text-xl text-gray-600 mb-6">{dateString}</p>
              
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border-b-2 border-gray-300 text-sm font-semibold text-gray-500 uppercase w-1/3">VAN</th>
                    <th className="p-2 border-b-2 border-gray-300 text-sm font-semibold text-gray-500 uppercase w-1/3">E WAYBILL</th>
                    <th className="p-2 border-b-2 border-gray-300 text-sm font-semibold text-gray-500 uppercase w-1/3">INVOICE</th>
                    <th className="p-2 border-b-2 border-gray-300 w-[40px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="p-2 border-b border-gray-200">
                        <input type="text" value={row.van} onChange={(e) => handleUpdateRow(row.id, 'van', e.target.value)} className="w-full bg-transparent focus:outline-none focus:bg-slate-100 rounded px-1 text-md" placeholder="e.g. CJB-MAA"/>
                      </td>
                      <td className="p-2 border-b border-gray-200">
                         <input type="text" value={row.eWaybill} onChange={(e) => handleUpdateRow(row.id, 'eWaybill', e.target.value)} className="w-full bg-transparent focus:outline-none focus:bg-slate-100 rounded px-1 text-md text-center" placeholder="—" />
                      </td>
                      <td className="p-2 border-b border-gray-200">
                         <input type="text" value={row.invoice} onChange={(e) => handleUpdateRow(row.id, 'invoice', e.target.value)} className="w-full bg-transparent focus:outline-none focus:bg-slate-100 rounded px-1 text-md text-center" placeholder="0" />
                      </td>
                      <td className="p-2 border-b border-gray-200 text-center">
                        <button onClick={() => handleRemoveRow(row.id)} className="text-gray-400 hover:text-red-500">
                            <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <p className="text-center text-gray-500 py-8">Table is empty. Click "Add Row" to begin.</p>}
               <p className="text-right mt-8 text-gray-700">- Basheer Ahamed</p>
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
