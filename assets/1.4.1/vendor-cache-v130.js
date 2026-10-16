(function (global) {
    'use strict';

    const VENDORS = Object.freeze({
        chart: {
            version: '4.5.1',
            url: 'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js'
        },
        xlsx: {
            version: '0.18.5',
            url: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
        }
    });

    const promesas = {};

    function cargarScript(id, url, condicion) {
        if (typeof condicion === 'function' && condicion()) return Promise.resolve(true);
        if (promesas[id]) return promesas[id];
        promesas[id] = new Promise((resolve, reject) => {
            const existente = document.getElementById(id);
            if (existente) {
                if (typeof condicion === 'function' && condicion()) return resolve(true);
                existente.addEventListener('load', () => resolve(true), { once:true });
                existente.addEventListener('error', () => reject(new Error('No se pudo cargar ' + url)), { once:true });
                return;
            }
            const script = document.createElement('script');
            script.id = id;
            script.src = url;
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve(true);
            script.onerror = () => {
                delete promesas[id];
                reject(new Error('No se pudo cargar ' + url));
            };
            document.head.appendChild(script);
        });
        return promesas[id];
    }

    function cargarChart() {
        if (typeof global.asegurarChartJS === 'function') return global.asegurarChartJS();
        return cargarScript('subli-chart-fijo-v130', VENDORS.chart.url, () => String(global.Chart?.version || '') === VENDORS.chart.version);
    }

    function cargarXLSX() {
        if (typeof global.asegurarXLSX === 'function') return global.asegurarXLSX();
        return cargarScript('subli-xlsx-fijo-v130', VENDORS.xlsx.url, () => Boolean(global.XLSX));
    }

    // Se conserva por compatibilidad, pero ya no descarga dependencias al iniciar.
    // Chart y Excel se solicitan solamente desde la función que realmente los usa.
    function instalar() {
        return true;
    }

    global.SubliVendorV130 = Object.freeze({ VENDORS, instalar, cargarChart, cargarXLSX });
})(window);
