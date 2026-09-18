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

    function cargarScript(id, url, condicion) {
        if (typeof condicion === 'function' && condicion()) return;
        if (document.getElementById(id)) return;
        const script = document.createElement('script');
        script.id = id;
        script.src = url;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.onerror = () => console.warn(`No se pudo cargar la dependencia fijada ${id}. Se conservará la disponible actualmente.`);
        document.head.appendChild(script);
    }

    function instalar() {
        // Chart puede cargarse después del login; XLSX queda estrictamente bajo demanda.
        if(typeof global.asegurarChartJS === 'function') {
            global.asegurarChartJS().catch(error => console.warn('No se pudo preparar Chart.js.', error));
        } else {
            cargarScript('subli-chart-fijo-v130', VENDORS.chart.url, () => String(global.Chart?.version || '') === VENDORS.chart.version);
        }
    }

    function asegurarXLSX() {
        if(typeof global.asegurarXLSX === 'function') return global.asegurarXLSX();
        return Promise.resolve(Boolean(global.XLSX));
    }

    global.SubliVendorV130 = Object.freeze({ VENDORS, instalar, asegurarXLSX });
    if (document.readyState === 'complete') instalar();
    else global.addEventListener('load', instalar, { once:true });
})(window);
